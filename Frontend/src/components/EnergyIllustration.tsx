export function EnergyIllustration({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 520 340" fill="none" aria-hidden="true">
    <defs><linearGradient id="land" x1="100" y1="180" x2="440" y2="320" gradientUnits="userSpaceOnUse"><stop stopColor="#b6cc93"/><stop offset="1" stopColor="#7eab87"/></linearGradient><pattern id="cells" width="20" height="18" patternUnits="userSpaceOnUse"><path d="M0 0H20V18H0Z" stroke="#8bb8b1" strokeWidth=".7"/></pattern></defs>
    <circle cx="387" cy="68" r="37" fill="#edcf67"/><circle cx="387" cy="68" r="52" stroke="#edcf67" strokeOpacity=".3"/>
    <path d="M34 209 251 104 496 231 274 335Z" fill="url(#land)"/>
    <path d="m34 209 240 126v10L34 220Z" fill="#749a71"/><path d="m274 335 222-104v10L274 345Z" fill="#5e8966"/>
    <path d="m123 167 225 117m-137-157 220 112" stroke="#dce9c4" strokeWidth="20"/>
    <path d="m233 225 114-55 69 34-114 56Z" fill="#d2debc"/>
    <g stroke="#567563" strokeWidth="4"><path d="M192 261v18m57 14v17m49-96v16m58 16v16"/></g>
    <g><path d="m141 233 69-45 77 38-69 47Z" fill="#1b5550"/><path d="m141 233 69-45 77 38-69 47Z" fill="url(#cells)"/><path d="m221 273 69-45 76 38-68 47Z" fill="#1b5550"/><path d="m221 273 69-45 76 38-68 47Z" fill="url(#cells)"/></g>
    <path d="M289 170v-42l37-20 42 23v43l-37 19Z" fill="#eef2dc"/><path d="m331 151 37-20v43l-37 19Z" fill="#c1d3b9"/><path d="m281 129 43-38 52 40-45 24Z" fill="#31594d"/><path d="m297 119 25-19 25 18-26 15Z" fill="#2a7770"/><path d="m342 157 11-6v17l-11 6Z" fill="#608b83"/><path d="m305 146 12 7v24l-12-6Z" fill="#b89f73"/>
    <path d="M211 127V96l26-14 28 16v31l-26 15Z" fill="#f4edda"/><path d="m239 111 26-13v31l-26 15Z" fill="#cbd6bd"/><path d="m204 97 29-28 38 29-32 17Z" fill="#628d75"/>
    <g stroke="#f7f6e8" strokeLinecap="round"><path d="M142 190V92" strokeWidth="7"/><path d="m142 92-3-49m3 49-40 27m40-27 41 25" strokeWidth="6"/></g><circle cx="142" cy="92" r="6" fill="#c1d0b3"/>
    <g><path d="M409 235v-31m-309 11v-32m281 107v-30" stroke="#466949" strokeWidth="5"/><ellipse cx="409" cy="191" rx="17" ry="28" fill="#3b795d"/><ellipse cx="100" cy="174" rx="17" ry="27" fill="#4c8763"/><ellipse cx="381" cy="251" rx="15" ry="24" fill="#438363"/></g>
    <path d="m200 159 35 17 37-16" stroke="#4f8770" strokeWidth="2" strokeDasharray="4 4"/>
    <circle cx="198" cy="158" r="5" fill="#d8edab"/><circle cx="272" cy="160" r="5" fill="#d8edab"/>
    <path d="M55 75h47m-24-24v47M446 139h22m-11-11v22" stroke="#9bbc92" strokeWidth="1.5"/>
  </svg>;
}
