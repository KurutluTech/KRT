# Allocation policy
Engine `allocateByDriver`: proportional split of an expense over weights; any target with an unknown weight makes the result UNKNOWN (never silently 0). `canAllocate` blocks over-allocation. Largest-remainder rounding keeps the total exact.
**BLOCKED — OWNER DECISION:** which driver applies to which category (machine hours, floor area, meter, headcount…). Until decided no allocation is created. Policies are versioned, dated and may not change a closed period.
Labor: concurrent multi-machine minutes are split across the machines (`allocateLaborMinutes`); salary data stays restricted; GEÇKO mapping is an owner decision.
