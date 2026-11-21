package in.bharatsim.paymock;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Proxy;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * BharatPay Mock: a TEST FIXTURE for BharatSim's "payment pending + retry" scenario.
 * It never touches a real payment system; it only talks to a mock gateway whose URL
 * is passed by the BharatSim worker as the "gateway" intent extra.
 *
 * Two builds come from this one source (see Flags.FIXED):
 *  - original: on a timeout it tells the user the payment FAILED, and Retry sends a
 *    brand-new idempotency key, so a slow bank confirmation turns into a double charge;
 *  - fixed: on a timeout it shows PENDING, checks the order status before retrying,
 *    and reuses one idempotency key per order, so a retry can never charge twice.
 */
public class MainActivity extends Activity {
    static final String TAG = "BSIM";
    static final int TIMEOUT_MS = 5000;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final String orderId = "ORD-" + UUID.randomUUID().toString().substring(0, 8);
    private String gateway;
    private TextView status;
    private Button pay;
    private Button retry;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        gateway = getIntent().getStringExtra("gateway");
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(40, 60, 40, 40);

        TextView title = new TextView(this);
        title.setTextSize(22);
        title.setText("BharatPay Mock " + (Flags.FIXED ? "(fixed build)" : "(original build)"));
        root.addView(title);

        TextView note = new TextView(this);
        note.setText("Test fixture for BharatSim. No real money. Order " + orderId + " · ₹499");
        note.setPadding(0, 12, 0, 32);
        root.addView(note);

        pay = new Button(this);
        pay.setText("Pay ₹499");
        pay.setContentDescription("pay_button");
        pay.setOnClickListener(v -> startPayment());
        root.addView(pay);

        status = new TextView(this);
        status.setTextSize(18);
        status.setPadding(0, 32, 0, 32);
        status.setContentDescription("status_text");
        status.setText(gateway == null ? "No test gateway configured." : "Ready to pay.");
        root.addView(status);

        retry = new Button(this);
        retry.setText(Flags.FIXED ? "Check status / Retry" : "Retry payment");
        retry.setContentDescription("retry_button");
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(v -> onRetry());
        root.addView(retry);

        setContentView(root);
        Log.i(TAG, "launch build=" + (Flags.FIXED ? "fixed" : "original") + " order=" + orderId);
    }

    private void setState(String state, String text, int color, boolean showRetry) {
        main.post(() -> {
            status.setText(text);
            status.setTextColor(color);
            retry.setVisibility(showRetry ? View.VISIBLE : View.GONE);
            Log.i(TAG, "state=" + state + " order=" + orderId);
        });
    }

    private String idempotencyKey() {
        // The bug under test: the original build makes a new key for every attempt.
        return Flags.FIXED ? orderId : UUID.randomUUID().toString();
    }

    private void startPayment() {
        if (gateway == null) return;
        pay.setEnabled(false);
        setState("PROCESSING", "Processing payment…", Color.DKGRAY, false);
        new Thread(() -> sendPayment(idempotencyKey())).start();
    }

    private void onRetry() {
        retry.setVisibility(View.GONE);
        setState("PROCESSING", "Processing payment…", Color.DKGRAY, false);
        new Thread(() -> {
            if (Flags.FIXED) {
                // Ask the bank what happened before paying again.
                String s = get("/status?order_id=" + orderId);
                if (s != null && s.contains("\"charged\": true")) {
                    setState("SUCCESS", "Payment successful (confirmed with bank).", Color.rgb(0, 120, 60), false);
                    return;
                }
            }
            sendPayment(idempotencyKey());
        }).start();
    }

    private void sendPayment(String key) {
        Log.i(TAG, "pay_request order=" + orderId + " key=" + key);
        try {
            String body = "{\"order_id\":\"" + orderId + "\",\"idempotency_key\":\"" + key + "\",\"amount\":499}";
            HttpURLConnection c = open("/pay");
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream o = c.getOutputStream()) {
                o.write(body.getBytes(StandardCharsets.UTF_8));
            }
            int code = c.getResponseCode();
            if (code == 200) {
                setState("SUCCESS", "Payment successful.", Color.rgb(0, 120, 60), false);
            } else {
                setState("FAILED", "Payment failed (" + code + "). Please retry.", Color.RED, true);
            }
        } catch (SocketTimeoutException e) {
            if (Flags.FIXED) {
                setState("PENDING", "Payment pending: waiting for bank confirmation. Do not pay again.", Color.rgb(180, 110, 0), true);
            } else {
                setState("FAILED", "Payment failed. Please retry.", Color.RED, true);
            }
        } catch (Exception e) {
            setState(Flags.FIXED ? "PENDING" : "FAILED",
                    Flags.FIXED ? "Payment status unknown: checking with bank." : "Payment failed. Please retry.",
                    Flags.FIXED ? Color.rgb(180, 110, 0) : Color.RED, true);
        }
    }

    private HttpURLConnection open(String path) throws Exception {
        // The mock gateway runs on the worker host; bypass the system proxy on purpose.
        HttpURLConnection c = (HttpURLConnection) new URL(gateway + path).openConnection(Proxy.NO_PROXY);
        c.setConnectTimeout(TIMEOUT_MS);
        c.setReadTimeout(TIMEOUT_MS);
        return c;
    }

    private String get(String path) {
        try {
            HttpURLConnection c = open(path);
            try (InputStream in = c.getInputStream()) {
                // InputStream.readAllBytes needs API 33; read manually for Android 11 devices.
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return new String(out.toByteArray(), StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            Log.w(TAG, "status_check_failed " + e);
            return null;
        }
    }
}
