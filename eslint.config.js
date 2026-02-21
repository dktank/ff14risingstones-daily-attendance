import antfu from '@antfu/eslint-config'

export default antfu(
  {
    typescript: true,
    stylistic: true,
    yaml: true,
  },
  {
    rules: {
      'no-console': 'off',
    },
  },
)
