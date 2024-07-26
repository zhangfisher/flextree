import antfu from '@antfu/eslint-config'

export default antfu({
    rules: {
        'brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'curly': ['error', 'multi-line'],
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/consistent-type-definitions': 'off',
        'test/consistent-test-it': 'off',
        'indent': ['warn', 4],
    },
    stylistic: {
        indent: 'tab',
        quotes: 'single',
    },
    ignores: [
        "examples/**",
        "*.md",
        "**/dist"
    ]
})
