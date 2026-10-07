<template>
  <section class="dashboard-page">
    <header class="dashboard-heading">
      <div>
        <p class="dashboard-eyebrow">Operations overview</p>
        <h1>
          Welcome back<span v-if="firstName">, {{ firstName }}</span>
        </h1>
        <p class="dashboard-intro">
          Your workspace for attendance records, employee identity mapping, and connected devices.
        </p>
      </div>
      <div class="role-chip">
        <span class="role-chip-dot" aria-hidden="true"></span>
        {{ roleLabel }} access
      </div>
    </header>

    <section class="dashboard-section" aria-labelledby="modules-title">
      <div class="section-heading">
        <div>
          <h2 id="modules-title">Operational modules</h2>
          <p>Open a workspace area to review current records and configuration.</p>
        </div>
      </div>

      <div class="module-grid">
        <router-link
          v-for="module in modules"
          :key="module.title"
          :to="module.to"
          class="module-card"
        >
          <span class="module-icon" :class="`module-icon-${module.tone}`" aria-hidden="true">
            {{ module.icon }}
          </span>
          <span class="module-card-content">
            <strong>{{ module.title }}</strong>
            <span>{{ module.description }}</span>
          </span>
          <span class="module-arrow" aria-hidden="true">→</span>
        </router-link>
      </div>
    </section>

    <section class="process-card" aria-labelledby="flow-title">
      <div class="process-copy">
        <p class="dashboard-eyebrow">How the workspace is organized</p>
        <h2 id="flow-title">From device activity to reviewable records</h2>
        <p>
          TimeBridge brings device attendance into a sequence of raw records, canonical events, rule
          results, and attendance cycles. Employee Mapping links device identities to employee
          records for downstream processing.
        </p>
      </div>
      <div class="process-steps" aria-label="Attendance processing stages">
        <span>Device</span><i aria-hidden="true">›</i><span>Raw records</span
        ><i aria-hidden="true">›</i> <span>Events</span><i aria-hidden="true">›</i
        ><span>Rules &amp; cycles</span>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const firstName = computed(() => authStore.user?.email.split('@')[0]?.split(/[._-]/)[0] ?? '');
const roleLabel = computed(() => authStore.user?.role.replaceAll('_', ' ') ?? 'User');

const modules = [
  {
    title: 'Raw Attendance',
    description: 'Review source attendance records received from device integrations.',
    to: '/attendance/raw',
    icon: '↘',
    tone: 'blue',
  },
  {
    title: 'Attendance Events',
    description: 'Inspect normalized canonical events and their processing status.',
    to: '/attendance/events',
    icon: '◷',
    tone: 'teal',
  },
  {
    title: 'Rule Results & Cycles',
    description: 'Review rule outcomes and attendance cycle records.',
    to: '/attendance/rule-results',
    icon: '≋',
    tone: 'violet',
  },
  {
    title: 'Employee Mapping',
    description: 'Manage time-bounded links between device and employee identities.',
    to: '/employee-mappings',
    icon: '⇄',
    tone: 'amber',
  },
  {
    title: 'Devices',
    description: 'View registered attendance devices and their reported health.',
    to: '/devices',
    icon: '▣',
    tone: 'slate',
  },
];
</script>

<style scoped>
.dashboard-page {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  color: #17233b;
}
.dashboard-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  margin-bottom: 2rem;
}
.dashboard-eyebrow {
  margin: 0 0 0.45rem;
  color: #75839a;
  font-size: 0.69rem;
  font-weight: 750;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
h1,
h2,
p {
  margin-top: 0;
}
h1 {
  margin-bottom: 0.55rem;
  color: #17233b;
  font-size: clamp(1.8rem, 3vw, 2.25rem);
  font-weight: 730;
  letter-spacing: -0.045em;
  line-height: 1.15;
}
.dashboard-intro {
  max-width: 42rem;
  margin-bottom: 0;
  color: #687791;
  font-size: 0.92rem;
  line-height: 1.6;
}
.role-chip {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid #dce6f8;
  border-radius: 999px;
  color: #31568f;
  background: #f7faff;
  font-size: 0.73rem;
  font-weight: 650;
  text-transform: capitalize;
}
.role-chip-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: #4484df;
}
.dashboard-section {
  margin-bottom: 1.35rem;
}
.section-heading {
  margin-bottom: 0.9rem;
}
.section-heading h2,
.process-copy h2 {
  margin-bottom: 0.25rem;
  color: #26344d;
  font-size: 1.04rem;
  font-weight: 700;
  letter-spacing: -0.015em;
}
.section-heading p {
  margin: 0;
  color: #7b889d;
  font-size: 0.79rem;
}
.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}
.module-card {
  display: flex;
  min-width: 0;
  min-height: 112px;
  align-items: center;
  gap: 0.9rem;
  padding: 1.05rem;
  border: 1px solid #e4eaf2;
  border-radius: 0.8rem;
  color: inherit;
  background: #fff;
  box-shadow: 0 1px 2px rgb(21 38 68 / 3%);
  text-decoration: none;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    transform 140ms ease;
}
.module-card:hover {
  transform: translateY(-1px);
  border-color: #cad8f0;
  box-shadow: var(--shadow-card);
}
.module-icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  font-size: 1.25rem;
  font-weight: 700;
}
.module-icon-blue {
  color: #2f61b6;
  background: #edf3ff;
}
.module-icon-teal {
  color: #167b79;
  background: #e9f8f5;
}
.module-icon-violet {
  color: #694cb5;
  background: #f2eeff;
}
.module-icon-amber {
  color: #9a6717;
  background: #fff5e4;
}
.module-icon-slate {
  color: #53657e;
  background: #eef2f6;
}
.module-card-content {
  display: grid;
  min-width: 0;
  gap: 0.3rem;
  flex: 1;
}
.module-card-content strong {
  color: #28364e;
  font-size: 0.87rem;
}
.module-card-content > span {
  color: #78869b;
  font-size: 0.75rem;
  line-height: 1.45;
}
.module-arrow {
  flex: 0 0 auto;
  color: #93a0b3;
  font-size: 1.05rem;
}
.process-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.4rem 1.5rem;
  border: 1px solid #dce6f4;
  border-radius: 0.85rem;
  background: linear-gradient(110deg, #fff 20%, #f4f8ff 100%);
}
.process-copy {
  max-width: 40rem;
}
.process-copy h2 {
  margin-bottom: 0.4rem;
}
.process-copy > p:last-child {
  margin: 0;
  color: #687791;
  font-size: 0.8rem;
  line-height: 1.55;
}
.process-steps {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.55rem;
  color: #52627d;
  font-size: 0.7rem;
  font-weight: 650;
}
.process-steps span {
  padding: 0.45rem 0.55rem;
  border: 1px solid #dce6f4;
  border-radius: 0.4rem;
  background: #fff;
  white-space: nowrap;
}
.process-steps i {
  color: #9aa8bd;
  font-size: 1rem;
  font-style: normal;
}
@media (max-width: 1000px) {
  .process-card {
    align-items: flex-start;
    flex-direction: column;
  }
  .process-steps {
    flex-wrap: wrap;
  }
}
@media (max-width: 640px) {
  .dashboard-heading {
    flex-direction: column;
    margin-bottom: 1.4rem;
  }
  .role-chip {
    margin-top: 0;
  }
  .module-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .module-card {
    min-height: 98px;
  }
  .process-card {
    padding: 1.1rem;
  }
  .process-steps {
    gap: 0.35rem;
  }
  .process-steps span {
    font-size: 0.64rem;
  }
}
</style>
