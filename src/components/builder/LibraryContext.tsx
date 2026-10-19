"use client";
import { createContext, useContext } from "react";
import { EMPTY_LIBRARY, type LibrarySnapshot } from "@/lib/study/library";

/** The researcher's current library, available to block and design editors. */
const LibraryContext = createContext<LibrarySnapshot>(EMPTY_LIBRARY);

export const LibraryProvider = LibraryContext.Provider;
export const useLibrary = () => useContext(LibraryContext);
