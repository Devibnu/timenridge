<template>
  <section class="download-page">
    <header class="download-heading">
      <div>
        <p class="download-eyebrow">Aplikasi Klien</p>
        <h1>Download TimeBridge</h1>
      </div>
    </header>

    <div class="download-grid">
      <!-- macOS -->
      <div class="download-card">
        <div class="os-icon">🍏</div>
        <h2>macOS</h2>
        <p class="os-desc">Untuk perangkat Apple Silicon (M1/M2/M3) dan Intel.</p>
        <div class="download-actions">
          <button class="download-button" disabled>
            Segera Hadir
          </button>
        </div>
      </div>

      <!-- Windows -->
      <div class="download-card">
        <div class="os-icon">🪟</div>
        <h2>Windows</h2>
        <p class="os-desc">Untuk perangkat Windows 10 dan 11 (64-bit).</p>
        <div class="download-actions">
          <button class="download-button" disabled>
            Segera Hadir
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Halaman Download Klien
</script>

<style scoped>
.download-page {
  width: 100%;
  min-width: 0;
  color: #1f2937;
}
.download-heading {
  margin-bottom: 2rem;
}
.download-eyebrow {
  margin: 0 0 0.3rem;
  color: #75839a;
  font-size: 0.69rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.download-heading h1 {
  margin: 0;
  color: #17233b;
  font-size: 1.7rem;
  font-weight: 730;
  letter-spacing: -0.035em;
}
.download-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}
.download-card {
  display: flex;
  flex-direction: column;
  padding: 2.5rem 2rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #fff;
  box-shadow: var(--shadow-card);
  text-align: center;
}
.os-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
}
.download-card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.45rem;
  font-weight: 700;
  color: #23314a;
}
.os-desc {
  margin: 0 0 2rem;
  color: #64748b;
  font-size: 0.88rem;
  line-height: 1.5;
  flex-grow: 1;
}
.download-actions {
  display: flex;
  justify-content: center;
}
.download-button {
  display: inline-flex;
  min-height: 2.6rem;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.5rem;
  border: 1px solid transparent;
  border-radius: 0.45rem;
  font-size: 0.85rem;
  font-weight: 650;
  color: #fff;
  background: #2859b8;
  cursor: pointer;
  width: 100%;
  transition: opacity 150ms ease;
}
.download-button:hover:not(:disabled) {
  background: #1e438f;
}
.download-button:disabled {
  background: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
}
</style>
