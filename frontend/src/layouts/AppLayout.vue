<template>
  <div class="app-shell">
    <div v-if="menuOpen" class="sidebar-backdrop" @click="menuOpen = false"></div>
    <aside id="primary-navigation" class="sidebar" :class="{ 'sidebar-open': menuOpen }">
      <router-link class="brand" to="/" aria-label="Dasbor TimeBridge" @click="closeMenu">
        <span class="brand-mark" aria-hidden="true">TB</span>
        <span class="brand-copy">
          <strong>TimeBridge</strong>
          <small>Operasional Kehadiran</small>
        </span>
      </router-link>

      <nav class="primary-nav" aria-label="Navigasi utama">
        <p class="nav-label">Ruang Kerja</p>
        <router-link
          class="nav-link"
          to="/"
          exact-active-class="nav-link-active"
          @click="closeMenu"
        >
          <span class="nav-icon" aria-hidden="true">⌂</span>
          <span>Dasbor</span>
        </router-link>

        <p class="nav-label nav-label-spaced">Kehadiran</p>
        <router-link
          v-for="link in attendanceLinks"
          :key="link.to"
          class="nav-link nav-link-child"
          :to="link.to"
          active-class="nav-link-active"
          @click="closeMenu"
        >
          <span class="nav-indicator" aria-hidden="true"></span>
          <span>{{ link.label }}</span>
        </router-link>

        <p class="nav-label nav-label-spaced">Direktori</p>
        <router-link
          class="nav-link"
          to="/employee-mappings"
          active-class="nav-link-active"
          @click="closeMenu"
        >
          <span class="nav-icon" aria-hidden="true">⇄</span>
          <span>Pemetaan Karyawan</span>
        </router-link>
        <router-link
          class="nav-link"
          to="/devices"
          active-class="nav-link-active"
          @click="closeMenu"
        >
          <span class="nav-icon" aria-hidden="true">▣</span>
          <span>Perangkat</span>
        </router-link>

        <p class="nav-label nav-label-spaced">Sistem</p>
        <router-link
          class="nav-link"
          to="/download"
          active-class="nav-link-active"
          @click="closeMenu"
        >
          <span class="nav-icon" aria-hidden="true">↓</span>
          <span>Download Aplikasi</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <span class="sidebar-footer-dot" aria-hidden="true"></span>
        <span>Ruang Kerja TimeBridge</span>
      </div>
    </aside>

    <div class="shell-main">
      <header class="topbar">
        <button
          class="menu-toggle"
          type="button"
          :aria-expanded="menuOpen"
          aria-controls="primary-navigation"
          :aria-label="menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'"
          @click="menuOpen = !menuOpen"
        >
          <span></span><span></span><span></span>
        </button>
        <div class="topbar-context">
          <span class="topbar-kicker">TimeBridge</span>
          <strong>{{ pageTitle }}</strong>
        </div>
        <div class="user-menu" v-if="authStore.user">
          <div class="user-avatar" aria-hidden="true">{{ initials }}</div>
          <div class="user-copy">
            <span class="user-email">{{ authStore.user.email }}</span>
            <span class="user-role">{{ roleLabel }}</span>
          </div>
          <button class="logout-button" type="button" @click="handleLogout">Keluar</button>
        </div>
      </header>

      <main class="main-content">
        <div class="breadcrumb" aria-label="Breadcrumb">
          <span>Ruang Kerja</span><span aria-hidden="true">/</span><strong>{{ pageTitle }}</strong>
        </div>
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const attendanceLinks = [
  { to: '/attendance/raw', label: 'Data Mentah Kehadiran' },
  { to: '/attendance/events', label: 'Kejadian Kehadiran' },
  { to: '/attendance/rule-results', label: 'Hasil Aturan' },
  { to: '/attendance/cycles', label: 'Siklus Kehadiran' },
];

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const menuOpen = ref(false);

const titles: Record<string, string> = {
  dashboard: 'Dasbor',
  'device-list': 'Perangkat',
  'device-new': 'Tambah perangkat',
  'device-detail': 'Detail perangkat',
  'device-edit': 'Edit perangkat',
  'attendance-raw': 'Data Mentah Kehadiran',
  'attendance-events': 'Kejadian Kehadiran',
  'attendance-rule-results': 'Hasil Aturan',
  'attendance-cycles': 'Siklus Kehadiran',
  'employee-mappings': 'Pemetaan Karyawan',
  'employee-mapping-new': 'Buat pemetaan',
  'employee-mapping-edit': 'Edit pemetaan',
  'download': 'Download Aplikasi',
};

const pageTitle = computed(() => titles[String(route.name)] ?? 'Ruang Kerja');
const roleLabel = computed(() => authStore.user?.role.replaceAll('_', ' ') ?? '');
const initials = computed(() => {
  const email = authStore.user?.email ?? '';
  return email.slice(0, 1).toUpperCase() || 'U';
});

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);

function closeMenu(): void {
  menuOpen.value = false;
}

async function handleLogout(): Promise<void> {
  await authStore.logout();
  await router.push('/login');
}
</script>

<style>
.app-shell {
  display: flex;
  min-height: 100vh;
  color: var(--color-ink);
}
.sidebar {
  position: fixed;
  z-index: 30;
  inset: 0 auto 0 0;
  display: flex;
  width: 258px;
  flex-direction: column;
  border-right: 1px solid #e5eaf1;
  background: #fff;
}
.brand {
  display: flex;
  min-height: 82px;
  align-items: center;
  gap: 0.8rem;
  padding: 0 1.35rem;
  border-bottom: 1px solid #edf0f5;
  color: inherit;
  text-decoration: none;
}
.brand-mark {
  display: grid;
  width: 2.55rem;
  height: 2.55rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.8rem;
  color: #fff;
  background: #2859b8;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.brand-copy,
.brand-copy strong,
.brand-copy small {
  display: block;
}
.brand-copy strong {
  font-size: 1rem;
  letter-spacing: -0.025em;
}
.brand-copy small {
  margin-top: 0.1rem;
  color: var(--color-muted);
  font-size: 0.69rem;
}
.primary-nav {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 0.85rem;
}
.nav-label {
  margin: 0 0 0.55rem;
  padding: 0 0.7rem;
  color: #8b97aa;
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.nav-label-spaced {
  margin-top: 1.55rem;
}
.nav-link {
  display: flex;
  min-height: 2.65rem;
  align-items: center;
  gap: 0.7rem;
  margin: 0.15rem 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.55rem;
  color: #52617a;
  font-size: 0.84rem;
  font-weight: 550;
  text-decoration: none;
  transition:
    color 140ms ease,
    background-color 140ms ease;
}
.nav-link:hover {
  color: #244f9f;
  background: #f4f7fc;
}
.nav-link-active,
.nav-link-active:hover {
  color: #214c9e;
  background: #edf3ff;
  font-weight: 700;
}
.nav-link-child {
  min-height: 2.4rem;
  padding-left: 1.25rem;
  font-size: 0.8rem;
}
.nav-icon {
  display: inline-grid;
  width: 1.1rem;
  flex: 0 0 auto;
  place-items: center;
  color: #71809a;
  font-size: 1.05rem;
  line-height: 1;
}
.nav-indicator {
  width: 0.35rem;
  height: 0.35rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #aab5c5;
}
.nav-link-active .nav-indicator {
  background: #2859b8;
  box-shadow: 0 0 0 3px #dbe7fc;
}
.sidebar-footer {
  display: flex;
  min-height: 54px;
  align-items: center;
  gap: 0.55rem;
  padding: 0 1.45rem;
  border-top: 1px solid #edf0f5;
  color: #71809a;
  font-size: 0.72rem;
}
.sidebar-footer-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: #33a36c;
}
.shell-main {
  display: flex;
  min-width: 0;
  min-height: 100vh;
  flex: 1;
  flex-direction: column;
  margin-left: 258px;
}
.topbar {
  position: sticky;
  z-index: 10;
  top: 0;
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 2rem;
  border-bottom: 1px solid #e5eaf1;
  background: rgb(255 255 255 / 96%);
  backdrop-filter: blur(12px);
}
.topbar-context,
.user-copy {
  display: grid;
  gap: 0.15rem;
}
.topbar-kicker {
  color: #8491a5;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.topbar-context strong {
  color: #23314a;
  font-size: 0.93rem;
}
.user-menu {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.7rem;
}
.user-avatar {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #dce6f8;
  border-radius: 50%;
  color: #2859b8;
  background: #edf3ff;
  font-size: 0.82rem;
  font-weight: 700;
}
.user-copy {
  min-width: 0;
  margin-right: 0.5rem;
}
.user-email {
  overflow: hidden;
  max-width: 15rem;
  color: #28364e;
  font-size: 0.78rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-role {
  color: #7b889c;
  font-size: 0.68rem;
  text-transform: capitalize;
}
.logout-button {
  min-height: 2.25rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid #e2e7ee;
  border-radius: 0.45rem;
  color: #536179;
  background: #fff;
  font-size: 0.76rem;
  font-weight: 650;
  cursor: pointer;
}
.logout-button:hover {
  border-color: #cbd5e1;
  color: #243149;
  background: #f8fafc;
}
.main-content {
  width: 100%;
  min-width: 0;
  flex: 1;
  padding: 1.35rem 2rem 2.5rem;
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0 auto 1.15rem;
  max-width: 1440px;
  color: #8a97aa;
  font-size: 0.72rem;
}
.breadcrumb strong {
  color: #5f6d83;
  font-weight: 650;
}
.menu-toggle,
.sidebar-backdrop {
  display: none;
}
@media (max-width: 1020px) {
  .sidebar {
    width: 236px;
  }
  .shell-main {
    margin-left: 236px;
  }
  .topbar {
    padding: 0 1.35rem;
  }
  .main-content {
    padding: 1.2rem 1.35rem 2rem;
  }
}
@media (max-width: 760px) {
  .sidebar {
    width: min(290px, calc(100vw - 52px));
    transform: translateX(-102%);
    transition: transform 180ms ease;
    box-shadow: 12px 0 32px rgb(17 34 61 / 12%);
  }
  .sidebar-open {
    transform: translateX(0);
  }
  .sidebar-backdrop {
    position: fixed;
    z-index: 20;
    inset: 0;
    display: block;
    background: rgb(15 27 47 / 42%);
  }
  .shell-main {
    margin-left: 0;
  }
  .topbar {
    min-height: 68px;
    justify-content: flex-start;
    padding: 0 1rem;
  }
  .menu-toggle {
    display: flex;
    width: 2.4rem;
    height: 2.4rem;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 1px solid #e2e7ee;
    border-radius: 0.5rem;
    background: #fff;
    cursor: pointer;
  }
  .menu-toggle span {
    width: 1rem;
    height: 2px;
    border-radius: 2px;
    background: #52617a;
  }
  .topbar-context {
    flex: 1;
  }
  .user-menu {
    gap: 0.45rem;
  }
  .user-copy {
    display: none;
  }
  .logout-button {
    padding: 0.3rem 0.55rem;
    font-size: 0.7rem;
  }
  .main-content {
    padding: 1rem 1rem 2rem;
  }
}
@media (max-width: 390px) {
  .topbar {
    gap: 0.55rem;
    padding: 0 0.65rem;
  }
  .topbar-context strong {
    font-size: 0.82rem;
  }
  .logout-button {
    padding-inline: 0.45rem;
  }
}
</style>
