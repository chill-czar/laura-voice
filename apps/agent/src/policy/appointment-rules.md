# Appointment Rules (demo/synthetic)

- Only offer a follow-up appointment after qualification has completed and produced a
  QUALIFIED or INSUFFICIENT result — never during initial intake.
- Always call `check_appointment_availability` before offering specific times; never
  invent a time slot.
- Confirm the chosen slot back to the caller before calling `schedule_follow_up`.
- Each scheduling attempt must reuse the same `appointmentRequestId` if retried, so the
  system does not double-book on a retried request (idempotency).
- Follow-up calls are the only appointment type this demo supports (`follow_up_call`).
