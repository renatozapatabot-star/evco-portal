# ONE-TOUCH VERIFICATION FRAMEWORK

## The Guarantee

It is impossible for a CRUZ pilot shipment to complete with more than 5 human touches without either (a) the shipment being flagged as failed in the post-mortem, or (b) Tito having explicitly pulled the kill switch.

## 7 Enforcement Layers

### LAYER 1: touch_count in Code
- `traficos.touch_count` INTEGER field incremented on every human action
- `traficos.touch_log` JSONB array: [{touch_number, timestamp, action, user}]
- touch_count > 5 fires red Telegram alert + auto-flags post-mortem
- Migration: `20260407_touch_verification.sql`

### LAYER 2: Approval Gate = Only Write Channel
- Pilot shipments writable only by service_role (CRUZ) or approval gate
- Juan Jose/Eloisa: READ access only on active pilot traficos
- Supabase RLS enforces at database level

### LAYER 3: Silent-Step Detection
- Every pipeline stage emits heartbeat to workflow_events on completion
- Missing heartbeat after timeout + no pending approval = yellow TG alert
- Prevents manual shadow-fixes before anyone notices

### LAYER 4: Shadow-Touch Detection
- Snapshot active pilot trafico every 60 seconds
- Field change not traceable to workflow_event or approval = shadow touch
- Shadow touch fires red TG to Renato IV + Tito simultaneously

### LAYER 5: 5-Gate Promotion
- Shipment advances ONLY when:
  (a) Green heartbeat from previous stage, OR
  (b) Approval gate authorized, OR
  (c) Tito kill switch
- No other advance mechanism exists
- Frozen shipments require Tito TG approval to unfreeze

### LAYER 6: Real-Time Touch Dashboard
- `/admin/touch-dashboard` (internal only)
- Live touch count per active shipment
- Projected final touches
- > 5 projected = red highlight
- Check at 6 AM and 6 PM

### LAYER 7: Post-Shipment Audit
- Automated on close-out
- Verifies: actual <= 5, every touch = allowed type, no shadow touches, audit_log proof
- Failed audit = "automation guarantee not met" in post-mortem
- 3 consecutive failures = automatic pause on new pilots

## The 5 Allowed Touches

| # | Who | Stage | Action |
|---|-----|-------|--------|
| 1 | Tito | Documents | Approve missing-doc request |
| 2 | Tito | Pedimento | Approve pedimento draft |
| 3 | Tito | Crossing | Approve carrier dispatch |
| 4 | Warehouse | Delivery | Confirm physical receipt |
| 5 | Tito | Summary | Approve client email |

Any other touch = system failure.
