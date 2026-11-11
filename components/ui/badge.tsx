import {cn} from '@/lib/utils';
export function Badge({children,className}:{children:React.ReactNode;className?:string}){return <span className={cn('inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold tracking-wide text-slate-600',className)}>{children}</span>;}
