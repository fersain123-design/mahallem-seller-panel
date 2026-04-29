import React from 'react';

type Props = {
  left: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
};

const AuthSplitLayout: React.FC<Props> = ({ left, children, className, leftClassName, rightClassName }) => {
  return (
    <div className={`relative min-h-screen overflow-hidden seller-auth-bg ${className || ''}`.trim()}>
      <div className="pointer-events-none absolute inset-0 seller-auth-grid" />
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -left-28 -top-28 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 -bottom-28 h-[30rem] w-[30rem] rounded-full bg-accent/12 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-[-14rem] h-[22rem] w-[22rem] rounded-full bg-primary/6 blur-3xl" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className={`order-2 lg:order-1 lg:col-span-5 lg:sticky lg:top-8 ${leftClassName || ''}`.trim()}>
            {left}
          </div>
          <div className={`order-1 lg:order-2 lg:col-span-7 ${rightClassName || ''}`.trim()}>{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AuthSplitLayout;
