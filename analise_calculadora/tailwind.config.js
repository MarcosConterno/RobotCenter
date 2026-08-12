/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',  // Para pegar arquivos dentro de src/app
    './pages/**/*.{js,ts,jsx,tsx}', // Diretórios de páginas
    './components/**/*.{js,ts,jsx,tsx}', // Diretórios de componentes
    './app/**/*.{js,ts,jsx,tsx}', // Se estiver utilizando app directory (Next.js 13+)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
