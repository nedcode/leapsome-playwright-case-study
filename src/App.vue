<script setup lang="ts">
import { RouterView } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
</script>

<template>
  <div class="h-full">
    <nav class="sticky top-0 bg-white shadow-sm">
      <div class="container max-w-6xl mx-auto px-4">
        <div class="flex justify-between items-center h-16">
          <div>
            <div class="flex items-center space-x-8">
              <div class="flex-shrink-0 text-indigo-600 font-extrabold">
                Leapsome

                <div class="text-xs font-normal text-gray-400">Develop your people, scale your business</div>
              </div>
            </div>
          </div>

          <div v-if="authStore.isLoggedIn" class="flex space-x-4 items-center">
            <button type="button" class="text-sm hover:underline focus:underline" @click="authStore.logout">
              Sign out
            </button>
            <img
              class="h-10 w-10 rounded-full"
              loading="lazy"
              :title="authStore.currentUser.username"
              :src="`https://avatars.dicebear.com/api/initials/${authStore.currentUser.username}.svg`"
              alt=""
            />
          </div>
        </div>
      </div>
    </nav>

    <main class="container max-w-6xl mx-auto px-4 py-10">
      <RouterView />
    </main>
  </div>
</template>
