<script setup lang="ts">
import { VThemeProvider, VDefaultsProvider, VCard } from "vuetify/components";
import FeedbackHost from "./FeedbackHost.vue";
import {
  shellThemeName,
  shellDefaults,
  type Brand,
  type ThemeChoice,
} from "./shell";
defineProps<{ brand: Brand; theme: ThemeChoice }>();
</script>
<template>
  <VThemeProvider
    :theme="shellThemeName(theme)"
    with-background
    class="zerp-auth-page"
  >
    <VDefaultsProvider :defaults="shellDefaults(theme)">
      <FeedbackHost>
        <VCard tag="main" variant="flat" class="zerp-auth-card">
          <header class="zerp-auth-brand">
            <span v-if="brand.mark.kind === 'text'" class="zerp-auth-mark">{{
              brand.mark.text
            }}</span>
            <img v-else :src="brand.mark.src" :alt="brand.mark.alt" />
            <h1>{{ brand.productName }}</h1>
            <div class="zerp-auth-brand-state">
              <slot name="brand-state"
                ><p>{{ brand.enterpriseName }}</p></slot
              >
            </div>
          </header>
          <slot />
        </VCard>
      </FeedbackHost>
    </VDefaultsProvider>
  </VThemeProvider>
</template>
