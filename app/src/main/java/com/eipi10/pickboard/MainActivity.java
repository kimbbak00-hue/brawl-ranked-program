package com.eipi10.pickboard;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** 시작 화면: 권한 → 픽보드 켜기 → 브롤스타즈 열기 */
public class MainActivity extends Activity {

    static final String BRAWL_PKG = "com.supercell.brawlstars";
    static final int INK = 0xFF121019, PANEL = 0xFF1B1825, LINE = 0xFF3A3350,
            FG = 0xFFF2EDFB, MUTE = 0xFFA59CBB, GOLD = 0xFFFFCF3F, GOLD_INK = 0xFF2A1F00, GOOD = 0xFF4FD18B;

    private TextView permState;
    private Button permBtn, startBtn, stopBtn, gameBtn;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(INK);
        getWindow().setNavigationBarColor(INK);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int p = dp(20);
        col.setPadding(p, dp(28), p, p);
        col.setBackgroundColor(INK);

        TextView title = text("브롤 픽보드", 26, FG);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        col.addView(title);
        TextView sub = text("경쟁전 밴픽 도우미 — 게임 위에 아이콘 줄로 떠 있어요.", 14, MUTE);
        sub.setPadding(0, dp(4), 0, dp(18));
        col.addView(sub);

        col.addView(step("1", "다른 앱 위에 표시 권한"));
        permState = text("", 13, MUTE);
        permState.setPadding(0, dp(2), 0, dp(6));
        col.addView(permState);
        permBtn = button("권한 설정 열기", false);
        permBtn.setOnClickListener(v -> openOverlaySettings());
        col.addView(permBtn);

        col.addView(gap(16));
        col.addView(step("2", "픽보드 켜기"));
        startBtn = button("픽보드 켜기", true);
        startBtn.setOnClickListener(v -> startOverlay(false));
        col.addView(startBtn);
        col.addView(gap(8));
        gameBtn = button("픽보드 켜고 브롤스타즈 열기", true);
        gameBtn.setOnClickListener(v -> startOverlay(true));
        col.addView(gameBtn);
        col.addView(gap(8));
        stopBtn = button("픽보드 끄기", false);
        stopBtn.setOnClickListener(v -> {
            Intent i = new Intent(this, OverlayService.class).setAction(OverlayService.ACTION_STOP);
            startService(i);
            refresh();
        });
        col.addView(stopBtn);

        col.addView(gap(22));
        TextView how = text(
                "쓰는 법\n" +
                "• 위쪽 손잡이(⋯)를 끌면 위치 이동, 한 번 누르면 손잡이만 남기고 숨김\n" +
                "• 아이콘을 누르면 패널이 펼쳐지고, 같은 아이콘이나 ✕로 접혀요\n" +
                "• 화면 오른쪽에 두면 패널이 왼쪽으로 펼쳐져요\n" +
                "• 게임 화면을 읽거나 건드리지 않아요. 입력은 직접 눌러서 해요\n" +
                "• 끄기: 아이콘 줄 맨 아래 ⏻ 또는 알림의 ‘끄기’", 13, MUTE);
        how.setLineSpacing(0, 1.3f);
        col.addView(how);

        TextView credit = text("made by eipi10", 11, LINE);
        credit.setPadding(0, dp(18), 0, 0);
        credit.setOnLongClickListener(v -> { Toast.makeText(this, "kimbbak", Toast.LENGTH_SHORT).show(); return true; });
        col.addView(credit);

        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(INK);
        sv.addView(col);
        setContentView(sv);

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private void refresh() {
        boolean ok = Settings.canDrawOverlays(this);
        permState.setText(ok ? "✓ 허용됨" : "아직 허용 안 됨 — 목록에서 ‘브롤 픽보드’를 켜주세요");
        permState.setTextColor(ok ? GOOD : GOLD);
        permBtn.setVisibility(ok ? View.GONE : View.VISIBLE);
        startBtn.setEnabled(ok);
        gameBtn.setEnabled(ok);
        startBtn.setAlpha(ok ? 1f : .4f);
        gameBtn.setAlpha(ok ? 1f : .4f);
        startBtn.setText(OverlayService.running ? "픽보드 켜짐 ✓" : "픽보드 켜기");
    }

    private void openOverlaySettings() {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
        try { startActivity(i); } catch (Exception e) { startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)); }
    }

    private void startOverlay(boolean openGame) {
        if (!Settings.canDrawOverlays(this)) { openOverlaySettings(); return; }
        Intent i = new Intent(this, OverlayService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
        if (openGame) {
            Intent g = getPackageManager().getLaunchIntentForPackage(BRAWL_PKG);
            if (g != null) startActivity(g);
            else Toast.makeText(this, "브롤스타즈가 설치돼 있지 않아요", Toast.LENGTH_SHORT).show();
        } else {
            moveTaskToBack(true);
        }
        refresh();
    }

    // ---------- tiny UI helpers ----------
    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    private TextView text(String s, float sp, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        return t;
    }

    private View step(String n, String label) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView num = text(n, 13, GOLD_INK);
        num.setGravity(Gravity.CENTER);
        num.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable c = new GradientDrawable();
        c.setShape(GradientDrawable.OVAL);
        c.setColor(GOLD);
        num.setBackground(c);
        row.addView(num, new LinearLayout.LayoutParams(dp(22), dp(22)));
        TextView l = text(label, 16, FG);
        l.setTypeface(Typeface.DEFAULT_BOLD);
        l.setPadding(dp(8), 0, 0, 0);
        row.addView(l);
        return row;
    }

    private Button button(String s, boolean primary) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        b.setTextColor(primary ? GOLD_INK : FG);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(10));
        bg.setColor(primary ? GOLD : PANEL);
        bg.setStroke(dp(1), primary ? GOLD : LINE);
        b.setBackground(bg);
        b.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
        return b;
    }

    private View gap(int h) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(h)));
        return v;
    }
}
