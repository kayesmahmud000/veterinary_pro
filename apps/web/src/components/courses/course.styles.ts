const styles = {
  shell: "min-w-0 space-y-8 py-8 sm:py-12",
  panel:
    "min-w-0 rounded-2xl border border-solid border-line bg-white p-5 sm:p-7",
  heading: "mb-3 break-words text-3xl font-semibold leading-tight sm:text-4xl",
  grid: "grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3",
  link: "inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-green underline-offset-4 hover:underline",
  badge:
    "inline-flex items-center gap-2 rounded-full bg-[#eff4ec] px-3 py-1 text-sm font-semibold text-green",
  input:
    "box-border min-h-12 w-full rounded-xl border border-solid border-line bg-white px-4 py-3 text-base text-ink",
} as const;
export default styles;
