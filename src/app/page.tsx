"use client";
import dynamic from "next/dynamic";
const IndieMapSplitView = dynamic(() => import("../components/IndieMapSplitView"), { ssr: false });
export default function Page(){ return <IndieMapSplitView/>; }
