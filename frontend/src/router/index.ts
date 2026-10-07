import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import Dashboard from '../views/Dashboard.vue';
import AppLayout from '../layouts/AppLayout.vue';
import DeviceList from '../views/devices/DeviceList.vue';
import DeviceForm from '../views/devices/DeviceForm.vue';
import DeviceDetail from '../views/devices/DeviceDetail.vue';
import AttendanceList from '../views/attendance/AttendanceList.vue';
import EmployeeMappingList from '../views/mappings/EmployeeMappingList.vue';
import EmployeeMappingForm from '../views/mappings/EmployeeMappingForm.vue';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresGuest: true },
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: Dashboard,
        },
        {
          path: 'devices',
          name: 'device-list',
          component: DeviceList,
        },
        {
          path: 'devices/new',
          name: 'device-new',
          component: DeviceForm,
        },
        {
          path: 'devices/:id',
          name: 'device-detail',
          component: DeviceDetail,
        },
        {
          path: 'devices/:id/edit',
          name: 'device-edit',
          component: DeviceForm,
        },
        {
          path: 'attendance/raw',
          name: 'attendance-raw',
          component: AttendanceList,
          props: { kind: 'raw' },
        },
        {
          path: 'attendance/events',
          name: 'attendance-events',
          component: AttendanceList,
          props: { kind: 'events' },
        },
        {
          path: 'attendance/rule-results',
          name: 'attendance-rule-results',
          component: AttendanceList,
          props: { kind: 'rule-results' },
        },
        {
          path: 'attendance/cycles',
          name: 'attendance-cycles',
          component: AttendanceList,
          props: { kind: 'cycles' },
        },
        {
          path: 'employee-mappings',
          name: 'employee-mappings',
          component: EmployeeMappingList,
        },
        {
          path: 'employee-mappings/new',
          name: 'employee-mapping-new',
          component: EmployeeMappingForm,
        },
        {
          path: 'employee-mappings/:id/edit',
          name: 'employee-mapping-edit',
          component: EmployeeMappingForm,
        },
      ],
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  // Fetch user if token exists but user state is not yet loaded (e.g., on page refresh)
  if (authStore.token && !authStore.user) {
    await authStore.fetchUser();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' });
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next({ name: 'dashboard' });
  } else {
    next();
  }
});

export default router;
