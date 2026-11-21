# BharatSim — Android Worker Infrastructure Architecture & Evaluation

**Auditor:** Infrastructure & Cloud Architecture Team  
**Evaluation Target:** Production Android Emulator Host with KVM / Nested Virtualization  

---

## 1. Cloud Provider Infrastructure Evaluation

Running the official Android Emulator (`emulator` / QEMU) at acceptable performance requires hardware virtualization (`/dev/kvm`). Without KVM acceleration, emulators run via pure software translation (TCG), which is 10× to 30× slower, causing cold-boot timeouts (>10 minutes) and severe UI freeze.

| Evaluation Metric | Google Cloud Engine (GCE) | Hetzner Dedicated | AWS EC2 (Metal) | AWS EC2 (Virtual) |
|---|---|---|---|---|
| **Recommended Shape** | `n2-standard-4` | `AX41-NVMe` | `c5.metal` | `c5.xlarge` / `c6i.xlarge` |
| **vCPU / RAM** | 4 vCPU / 16 GB RAM | 6 Core AMD / 64 GB RAM | 96 vCPU / 192 GB RAM | 4 vCPU / 8 GB RAM |
| **KVM Support** | **Verified Native** (`--enable-nested-virtualization`) | **Verified Native** (Bare-metal hardware) | **Verified Native** (Bare-metal hardware) | ❌ **Unsupported** (AWS blocks nested virt on non-metal) |
| **Boot Disk** | 100 GB Balanced SSD | 512 GB NVMe SSD | 100 GB EBS GP3 | 100 GB EBS GP3 |
| **Cost Profile** | ~$0.19 / hour (~$140 / month) | ~€39.00 / month (~$42 / month) | ~$4.08 / hour (~$2,950 / month) | ~$0.17 / hour |
| **Incubator Recommendation** | **Primary Cloud Recommendation** | **Best Performance / Cost** | Over-provisioned / Cost-prohibitive | Blocked by AWS hypervisor |

---

## 2. Hardware Virtualization Verification Criteria

The automated setup script (`deploy/worker/setup-worker-host.sh`) verifies hardware acceleration using three independent checks:

1. **Kernel Module Check:**
   ```bash
   lsmod | grep -E "kvm_intel|kvm_amd"
   ```
2. **CPU Capability Check:**
   ```bash
   kvm-ok
   # Expected Output: "INFO: /dev/kvm exists" and "KVM acceleration can be used"
   ```
3. **Character Device Permission Check:**
   ```bash
   test -r /dev/kvm && test -w /dev/kvm
   ```

---

## 3. Worker Host Isolation & Sandboxing

To ensure security when running untrusted developer APKs, the worker host employs multi-layered systemd isolation:

```ini
# From deploy/worker/bharatsim-worker.service
[Service]
User=bharatsim
Group=bharatsim
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/bharatsim /tmp /opt/bharatsim
RestrictSUIDSGID=true
LockPersonality=true
MemoryMax=4G
CPUQuota=300%
TasksMax=256
```

- **Restricted System Access:** `ProtectSystem=strict` mounts `/usr`, `/boot`, and `/etc` as read-only.
- **Resource Bounds:** Worker is restricted to 4 GB RAM and 300% CPU (3 cores) to prevent runaway resource exhaustion.
- **Isolated AVD Directory:** Emulators run from `/var/lib/bharatsim/avd` with wipe-data flags (`-wipe-data -no-snapshot`) to prevent state cross-contamination between test runs.
