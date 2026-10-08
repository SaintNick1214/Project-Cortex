import { cases } from "./cases.mjs";
export const reasons = Object.freeze([
  "not_reached", "observed_assertions", "dependency_blocked", "operator_setup_unavailable", "setup_failed",
  "child_crash", "child_disconnect", "whole_timeout", "case_timeout", "protocol_rejected", "driver_failure",
  "bounded_timeout", "bounded_observation_timeout", "expected_auth_denial_required", "unexpected_authorization_success",
  "operator_rejection_required", "unexpected_operator_success", "no_post_revocation_delivery", "capability_rejection_required",
  "operator_unavailable", "sanitized_assertion_or_service_failure", "unexpected_forbidden", "unexpected_unauthenticated", "unexpected_internal_only",
]);
export class CaseLedger {
  constructor() { this.rows = cases.map((name) => ({ name, status: "BLOCKED", reason: "not_reached" })); this.active = undefined; this.effects = []; }
  start(name) {
    if (!cases.includes(name) || this.active || this.rows.find((row) => row.name === name).reason !== "not_reached") throw new Error("PROTOCOL_REJECTED");
    this.active = name; Object.assign(this.rows.find((entry) => entry.name === name), { status: "RUNNING", reason: "not_reached" });
  }
  end(name, status, reason) {
    if (this.active !== name || !["PASS", "FAIL", "BLOCKED"].includes(status) || !reasons.includes(reason)) throw new Error("PROTOCOL_REJECTED");
    Object.assign(this.rows.find((row) => row.name === name), { status, reason }); this.active = undefined;
  }
  block(name, reason = "dependency_blocked") {
    if (this.active || !cases.includes(name) || this.rows.find((row) => row.name === name).reason !== "not_reached") throw new Error("PROTOCOL_REJECTED");
    Object.assign(this.rows.find((row) => row.name === name), { status: "BLOCKED", reason });
  }
  abnormal(reason) {
    if (!reasons.includes(reason)) reason = "driver_failure";
    if (this.active) this.end(this.active, "FAIL", reason);
    for (const row of this.rows) if (row.reason === "not_reached") row.reason = "dependency_blocked";
  }
  receipt() {
    const passed = this.rows.filter((row) => row.status === "PASS").length;
    return { discovered: cases.length, executed: this.rows.filter((row) => row.status !== "BLOCKED").length, passed,
      skipped: this.rows.filter((row) => row.status === "BLOCKED").length,
      status: this.rows.some((row) => row.status === "FAIL") ? "FAIL" : passed === cases.length ? "PASS" : "INCOMPLETE", results: this.rows, effects: this.effects };
  }
}
