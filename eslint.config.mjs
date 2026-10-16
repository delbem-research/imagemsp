import ttossEslintConfig from '@ttoss/eslint-config';

export default [
  ...ttossEslintConfig,
  {
    // Offline generators run from the terminal: reporting what they wrote is
    // their interface, so `no-console` (an error in app code, where a stray log
    // ships to users) does not apply to them.
    files: ['scripts/**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/src/generated/**',
      '.commitlintrc.js',
      '.lintstagedrc.js',
      '**/coverage/**',
      '.next/**',
      'next-env.d.ts',
      'dist/**',
      'build/**',
      'out/**',
      'public/**',
    ],
  },
  {
    rules: {
      'formatjs/no-literal-string-in-jsx': 'off',
      'react-refresh/only-export-components': [
        'warn',
        {
          allowExportNames: [
            'metadata',
            'generateMetadata',
            'viewport',
            'generateViewport',
            'dynamic',
            'dynamicParams',
            'revalidate',
            'fetchCache',
            'runtime',
            'preferredRegion',
            'maxDuration',
            'generateStaticParams',
            // Metadata image files (`opengraph-image.tsx`).
            'alt',
            'size',
            'contentType',
          ],
        },
      ],
    },
  },
];
