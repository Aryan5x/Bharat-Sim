package in.bharatsim.fragile;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * Deliberately fragile sample app for BharatSim demos. Every weakness here is a
 * real, common mistake:
 *  - the feed download uses a 4 second timeout and lets the exception escape
 *    its thread, so a slow or missing network crashes the app;
 *  - list rows do slow work on the main thread, so scrolling janks;
 *  - a large image cache is held in memory from the first launch.
 */
public class MainActivity extends Activity {
    static final String FEED_URL = "https://raw.githubusercontent.com/kaustubhdua/Bharat-Sim/main/fixtures/feed.bin";
    static final List<byte[]> IMAGE_CACHE = new ArrayList<>();

    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Mistake: warm a 48 MB "image cache" up front on a 2 GB phone.
        if (IMAGE_CACHE.isEmpty()) {
            for (int i = 0; i < 12; i++) IMAGE_CACHE.add(new byte[4 * 1024 * 1024]);
        }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        status = new TextView(this);
        status.setPadding(32, 48, 32, 24);
        status.setTextSize(18);
        status.setText("Fragile News: loading today's feed...");
        root.addView(status);
        ListView list = new ListView(this);
        list.setAdapter(new SlowAdapter());
        root.addView(list, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        loadFeed();
    }

    private void loadFeed() {
        new Thread(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(FEED_URL + "?t=" + System.currentTimeMillis()).openConnection();
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(4000);
                long start = SystemClock.elapsedRealtime();
                int total = 0;
                try (InputStream in = conn.getInputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        total += n;
                        // Mistake: treat a slow download as fatal instead of degrading.
                        if (SystemClock.elapsedRealtime() - start > 6000) {
                            throw new IllegalStateException("Feed took longer than 6 s to download");
                        }
                    }
                }
                final int kb = total / 1024;
                runOnUiThread(() -> status.setText("Fragile News: feed loaded (" + kb + " KB)"));
            } catch (Exception e) {
                // Mistake: rethrow on a background thread, which kills the process.
                throw new RuntimeException("Feed download failed", e);
            }
        }, "feed-loader").start();
    }

    private class SlowAdapter extends BaseAdapter {
        @Override public int getCount() { return 400; }
        @Override public Object getItem(int position) { return position; }
        @Override public long getItemId(int position) { return position; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            // Mistake: no view recycling and slow work on the main thread for every row.
            TextView row = new TextView(MainActivity.this);
            row.setPadding(32, 28, 32, 28);
            row.setTextSize(16);
            row.setTextColor(Color.DKGRAY);
            SystemClock.sleep(28);
            row.setText("Headline " + (position + 1) + ": monsoon update, markets, cricket");
            return row;
        }
    }
}
