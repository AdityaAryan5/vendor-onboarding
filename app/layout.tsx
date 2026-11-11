import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'Accord | Vendor onboarding',description:'A transparent vendor onboarding workflow. India policy v1.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
