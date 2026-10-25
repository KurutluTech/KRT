// Planlama Merkezi / Makine Detayı — data adapter for migration 0149 RPCs (DRAFT, not deployed).
// Same shape as routingApi.js: client.rpc(fn, args, session). Authority is enforced SERVER-SIDE
// (queue_can_reorder → permission_grants); the UI only hides controls, it never grants anything.
export function createMachineQueueApi(client, session) {
  const rpc = (fn, args) => client.rpc(fn, args, session);
  return {
    canReorder: () => rpc('queue_can_reorder', {}),
    queue: (machineId) => rpc('machine_queue', { p_machine: machineId }),
    impact: (machineId, orderedOpIds) => rpc('machine_queue_impact', { p_machine: machineId, p_ordered: orderedOpIds }),
    reorder: (machineId, orderedOpIds, expectedVersion, reason) => {
      if (!reason || !String(reason).trim()) throw new Error('REASON_REQUIRED');
      return rpc('machine_queue_reorder', { p_machine: machineId, p_ordered: orderedOpIds, p_expected_version: expectedVersion, p_reason: reason });
    },
    reassign: (opId, toMachineId, expectedVersionTo, reason) => {
      if (!reason || !String(reason).trim()) throw new Error('REASON_REQUIRED');
      return rpc('machine_queue_reassign', { p_op: opId, p_to_machine: toMachineId, p_expected_version_to: expectedVersionTo, p_reason: reason });
    },
  };
}
