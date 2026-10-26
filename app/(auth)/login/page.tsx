import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "ログイン | Crypto Trade Sim" };

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Suspense fallback={<div className="text-muted-foreground">読み込み中...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
