import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: 'Painel de leads | Ana Clara Resende',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
