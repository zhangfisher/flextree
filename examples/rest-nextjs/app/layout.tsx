export const metadata = { title: "flextree-rest nextjs example" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="zh">
            <body>
                <div style={{ fontFamily: "sans-serif", padding: 24 }}>
                    <h1>flextree-rest + Next.js</h1>
                    <p>
                        API 挂载在 <code>/api/trees</code>，试试{" "}
                        <a href="/api/trees">/api/trees</a>
                    </p>
                </div>
                {children}
            </body>
        </html>
    );
}
