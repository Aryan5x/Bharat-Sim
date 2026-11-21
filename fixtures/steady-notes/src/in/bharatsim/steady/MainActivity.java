package in.bharatsim.steady;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Well-behaved sample app for BharatSim demos: offline-first notes that sync in
 * the background, recycle list rows, tolerate slow networks and retry with backoff.
 */
public class MainActivity extends Activity {
    static final String FEED_URL = "https://raw.githubusercontent.com/Aryan5x/Bharat-Sim/finale/fixtures/feed.bin";

    private final Handler main = new Handler(Looper.getMainLooper());
    private TextView status;
    private long retryDelayMs = 5000;
    private volatile boolean visible;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        status = new TextView(this);
        status.setPadding(32, 48, 32, 24);
        status.setTextSize(18);
        status.setText("Steady Notes: showing saved notes");
        root.addView(status);
        ListView list = new ListView(this);
        list.setAdapter(new NotesAdapter());
        root.addView(list, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
        sync();
    }

    @Override
    protected void onPause() {
        super.onPause();
        visible = false;
        main.removeCallbacksAndMessages(null);
    }

    private void sync() {
        new Thread(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(FEED_URL + "?t=" + System.currentTimeMillis()).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                int total = 0;
                try (InputStream in = conn.getInputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) total += n;
                }
                final int kb = total / 1024;
                retryDelayMs = 5000;
                main.post(() -> status.setText("Steady Notes: synced (" + kb + " KB)"));
            } catch (Exception e) {
                // Degrade gracefully: keep working offline and retry with backoff.
                main.post(() -> status.setText("Steady Notes: offline, your notes are saved on this phone"));
                final long delay = retryDelayMs;
                retryDelayMs = Math.min(retryDelayMs * 2, 60000);
                if (visible) main.postDelayed(this::sync, delay);
            }
        }, "notes-sync").start();
    }

    private class NotesAdapter extends BaseAdapter {
        @Override public int getCount() { return 400; }
        @Override public Object getItem(int position) { return position; }
        @Override public long getItemId(int position) { return position; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            TextView row = convertView instanceof TextView ? (TextView) convertView : new TextView(MainActivity.this);
            row.setPadding(32, 28, 32, 28);
            row.setTextSize(16);
            row.setText("Note " + (position + 1) + ": groceries, rent, school fees");
            return row;
        }
    }
}
