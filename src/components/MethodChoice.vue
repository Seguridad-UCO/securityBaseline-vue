<script setup lang="ts">
import type { HttpMethod } from "../api/contracts";
const model = defineModel<HttpMethod>({ required: true });
const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
</script>
<template>
  <div class="method-choice">
    <span>Método HTTP</span>
    <div>
      <button
        v-for="method in methods"
        :key="method"
        type="button"
        :class="{ chosen: model === method }"
        @click="model = method"
      >
        {{ method }}
      </button>
    </div>
  </div>
</template>
