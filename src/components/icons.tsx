type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const SearchIcon = ({ size = 18 }: P) => (<svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);
export const UserIcon = ({ size = 22 }: P) => (<svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>);
export const BagIcon = ({ size = 22 }: P) => (<svg {...base(size)}><path d="M5 8h14l-1 13H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>);
export const TruckIcon = ({ size = 28 }: P) => (<svg {...base(size)}><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>);
export const PencilIcon = ({ size = 28 }: P) => (<svg {...base(size)}><path d="M3 17L17 3l4 4L7 21H3v-4z" /><path d="M14 6l4 4" /></svg>);
export const CardIcon = ({ size = 28 }: P) => (<svg {...base(size)}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>);
export const BuildingIcon = ({ size = 28 }: P) => (<svg {...base(size)}><path d="M4 21V5l8-2v18" /><path d="M12 9h8v12" /><path d="M2 21h20" /></svg>);
export const ChatIcon = ({ size = 26 }: P) => (<svg {...base(size)}><path d="M4 20l1.4-4.2A8 8 0 1112 20a8 8 0 01-3.6-.9L4 20z" /></svg>);
export const TrashIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>);
export const CheckIcon = ({ size = 18 }: P) => (<svg {...base(size)}><path d="M5 12l5 5 9-10" /></svg>);
