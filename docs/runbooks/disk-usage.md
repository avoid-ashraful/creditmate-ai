# Disk usage

**Alerts:** `CreditmateNodeDiskUsageHigh` (warning, > 80% for 15m), `CreditmateNodeDiskUsageCritical` (critical, > 90% for 10m).

## 1. Identify the disk and the cause

```bash
kubectl -n <ns> get pods -o wide                       # which node is it on
kubectl debug node/<node> -it --image=busybox -- df -h  # mount usage on the node
```

Typical causes, in order of likelihood:

1. Container logs or image layers on the node (`/var/lib/containerd`, `/var/log/pods`).
2. Elasticsearch data volume (staging compose, or a self-managed cluster).
3. PostgreSQL data volume on a self-managed host. Managed databases should not hit this.
4. Redis AOF growth (`appendonly yes` in `docker-compose.staging.yml`).

## 2. Reduce pressure

- Logs: check the kubelet `containerLogMaxSize` setting. Do not delete files under `/var/lib/containerd` by hand.
- Unused images: `crictl rmi --prune` on the node, after confirming no running pod uses them.
- Redis: check `INFO persistence` and whether `rdb` or `aof` files are the large ones before trimming anything.
- Elasticsearch: delete only indices you can rebuild. Check the index with `_cat/indices?v&s=store.size:desc`.

## 3. Confirm

- The panel drops below 80%.
- Note the cause and the growth rate in the incident channel. If growth is steady, open a ticket for a larger volume
  rather than cleaning up every week.

## 4. Never

- Do not expand a volume without checking that the storage class supports online resize.
- Do not run `rm -rf` on a volume that may hold database files, even when the disk is full.
