package com.eipi10.pickboard;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.hardware.display.DisplayManager;
import android.view.Display;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * 게임 위에 뜨는 픽보드 창.
 * - 접힘: 아이콘 줄(52dp)만, 펼침: 아이콘 줄 + 패널.
 * - FLAG_NOT_FOCUSABLE 이라 게임이 포커스를 잃지 않고, 창 바깥 터치는 그대로 게임으로 간다.
 */
public class OverlayService extends Service {

    static final String ACTION_STOP = "com.eipi10.pickboard.STOP";
    static final String CH = "overlay";
    static volatile boolean running = false;

    private static final int RAIL_DP = 52, PANEL_DP = 300, HANDLE_DP = 22, MAX_H_DP = 460, MARGIN_DP = 6;

    private WindowManager wm;
    private WindowManager.LayoutParams lp;
    private LinearLayout root;
    private WebView web;
    private TextView handle;
    private final Handler main = new Handler(Looper.getMainLooper());
    private SharedPreferences prefs;

    private boolean expanded = false, hidden = false, rightSide = false;

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            startInForeground();
            if (root == null) createOverlay();
            running = true;
        } catch (Exception e) {
            // 권한이 꺼졌거나 백그라운드 시작이 막힌 경우: 조용히 종료
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    // ---------- foreground notification ----------
    private void startInForeground() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, "픽보드 실행 중", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        PendingIntent stop = PendingIntent.getService(this, 1,
                new Intent(this, OverlayService.class).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent open = PendingIntent.getActivity(this, 2,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(this, CH)
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .setContentTitle("브롤 픽보드 켜짐")
                .setContentText("게임 위에 아이콘 줄이 떠 있어요")
                .setContentIntent(open)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "끄기", stop).build())
                .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(7, n);
        }
    }

    // ---------- overlay ----------
    private void createOverlay() {
        Context ctx = this;
        if (Build.VERSION.SDK_INT >= 30) {
            // 안드로이드 11+: 오버레이 전용 윈도 컨텍스트로 만들어야 화면 크기·회전이 정확함
            Display d = getSystemService(DisplayManager.class).getDisplay(Display.DEFAULT_DISPLAY);
            ctx = createDisplayContext(d).createWindowContext(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, null);
        }
        wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        prefs = getSharedPreferences("overlay", MODE_PRIVATE);

        root = new LinearLayout(ctx);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFF121019);

        handle = new TextView(ctx);
        handle.setText("⋯");
        handle.setTextColor(0xFFA59CBB);
        handle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        handle.setTypeface(Typeface.DEFAULT_BOLD);
        handle.setGravity(Gravity.CENTER);
        handle.setBackgroundColor(0xFF262235);
        handle.setContentDescription("픽보드 이동 손잡이");
        root.addView(handle, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(HANDLE_DP)));

        web = new WebView(ctx);
        web.setBackgroundColor(0xFF121019);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return true; // 링크로 게임을 벗어나지 않도록 페이지 이동은 막는다
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        web.loadDataWithBaseURL("https://pickboard.local/", readAsset("index.html"), "text/html", "utf-8", null);

        lp = new WindowManager.LayoutParams(
                dp(RAIL_DP), windowHeight(),
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.OPAQUE);
        lp.gravity = Gravity.TOP | Gravity.START;
        if (Build.VERSION.SDK_INT >= 28) {
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        lp.x = prefs.getInt("x", dp(MARGIN_DP));
        lp.y = prefs.getInt("y", dp(MARGIN_DP));
        clamp();
        rightSide = isRightHalf();

        handle.setOnTouchListener(new DragListener());
        wm.addView(root, lp);
        main.postDelayed(this::pushSide, 300);
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int r;
            while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return "<p style='color:#fff'>화면 파일을 못 읽었어요: " + e + "</p>";
        }
    }

    /** 펼침/접힘/숨김 상태에 맞춰 창 크기를 다시 계산 */
    private void applySize() {
        if (root == null) return;
        int railW = dp(RAIL_DP);
        int screenW = screen().width();
        int fullW = Math.min(railW + dp(PANEL_DP), screenW - dp(MARGIN_DP) * 2);
        int oldW = lp.width;
        int newW = hidden ? railW : (expanded ? fullW : railW);
        int newH = hidden ? dp(HANDLE_DP) : windowHeight();
        // 오른쪽에 붙어 있으면 아이콘 줄 위치를 고정하고 패널이 왼쪽으로 펼쳐지게
        if (rightSide && oldW != newW) lp.x = lp.x + oldW - newW;
        lp.width = newW;
        lp.height = newH;
        clamp();
        try { wm.updateViewLayout(root, lp); } catch (Exception ignored) { }
    }

    private int windowHeight() {
        return Math.min(screen().height() - dp(MARGIN_DP) * 2, dp(MAX_H_DP));
    }

    private Rect screen() {
        if (Build.VERSION.SDK_INT >= 30) {
            return wm.getMaximumWindowMetrics().getBounds();
        }
        DisplayMetrics m = new DisplayMetrics();
        wm.getDefaultDisplay().getRealMetrics(m);
        return new Rect(0, 0, m.widthPixels, m.heightPixels);
    }

    private void clamp() {
        Rect sc = screen();
        lp.x = Math.max(0, Math.min(lp.x, sc.width() - lp.width));
        lp.y = Math.max(0, Math.min(lp.y, sc.height() - lp.height));
    }

    private boolean isRightHalf() {
        return lp.x + lp.width / 2 > screen().width() / 2;
    }

    private void pushSide() {
        if (web != null) web.evaluateJavascript("window.__setSide&&window.__setSide('" + (rightSide ? "right" : "left") + "')", null);
    }

    private void savePos() {
        prefs.edit().putInt("x", lp.x).putInt("y", lp.y).apply();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        main.postDelayed(this::applySize, 250); // 회전하면 높이·위치 다시 맞춤
    }

    @Override
    public void onDestroy() {
        running = false;
        if (root != null) {
            try { wm.removeView(root); } catch (Exception ignored) { }
            web.destroy();
            root = null;
        }
        super.onDestroy();
    }

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    /** 손잡이: 끌면 이동, 짧게 누르면 숨김/보이기 */
    private class DragListener implements View.OnTouchListener {
        float sx, sy;
        int ox, oy;
        boolean moved;
        final int slop = ViewConfiguration.get(OverlayService.this).getScaledTouchSlop();

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    sx = e.getRawX(); sy = e.getRawY(); ox = lp.x; oy = lp.y; moved = false;
                    handle.setBackgroundColor(0xFF3A3350);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                    if (!moved && Math.abs(dx) < slop && Math.abs(dy) < slop) return true;
                    moved = true;
                    lp.x = ox + (int) dx;
                    lp.y = oy + (int) dy;
                    clamp();
                    try { wm.updateViewLayout(root, lp); } catch (Exception ignored) { }
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    handle.setBackgroundColor(0xFF262235);
                    if (moved) {
                        boolean r = isRightHalf();
                        if (r != rightSide) { rightSide = r; pushSide(); }
                        savePos();
                    } else if (e.getActionMasked() == MotionEvent.ACTION_UP) {
                        hidden = !hidden;
                        handle.setText(hidden ? "▾" : "⋯");
                        applySize();
                    }
                    return true;
            }
            return false;
        }
    }

    /** 웹 화면 → 창 제어 */
    private class Bridge {
        @JavascriptInterface
        public void setExpanded(boolean on) {
            main.post(() -> {
                if (expanded == on) return;
                expanded = on;
                applySize();
            });
        }

        @JavascriptInterface
        public void close() {
            main.post(OverlayService.this::stopSelf);
        }

        @JavascriptInterface
        public boolean isNative() { return true; }
    }
}
