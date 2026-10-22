<script setup lang="ts">
// Compiled in source and independent tgz consumers; no runtime route or private VM.
import {
  VoucherView,
  type VoucherOperationDefinition,
  type VoucherOperationIntent,
} from "@zerp/ui";
import type { SyntheticModel, Identity, Baseline } from "./operation-adapter";
import { sample } from "./adapters";
defineProps<{
  definition: VoucherOperationDefinition<SyntheticModel, Identity, Baseline>;
  intent: VoucherOperationIntent<SyntheticModel, Identity>;
  submission: ReturnType<typeof sample>;
}>();
</script>
<template>
  <VoucherView
    :definition="definition"
    :intent="intent"
    :eligible="true"
    :recovery-allowed="true"
  />
  <VoucherView
    :definition="submission"
    scope="session"
    :permissions="{ read: true, write: true }"
  />
  <!-- @vue-expect-error Operation cannot silently accept submission props. -->
  <VoucherView
    :definition="definition"
    :intent="intent"
    :eligible="true"
    :recovery-allowed="true"
    scope="wrong-protocol"
    :permissions="{ read: true, write: true }"
  />
  <!-- @vue-expect-error Submission cannot accept operation intent/qualifications. -->
  <VoucherView
    :definition="submission"
    scope="session"
    :permissions="{ read: true, write: true }"
    :intent="intent"
    :eligible="true"
    :recovery-allowed="true"
  />
</template>
