"use client";

import { Provider } from "react-redux";
import { ReactNode } from "react";
import store from "./store";

type ProvidersProps = {
  children: ReactNode;
};

const Providers = ({ children }: ProvidersProps) => {
  return <Provider store={store}>{children}</Provider>;
};

export default Providers;
