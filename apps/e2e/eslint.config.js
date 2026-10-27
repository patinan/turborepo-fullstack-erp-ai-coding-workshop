import base from '@erp/eslint-config/base';

export default [...base, { ignores: ['test-results/**', 'playwright-report/**'] }];
