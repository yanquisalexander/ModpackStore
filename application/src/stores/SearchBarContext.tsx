import { createContext, useContext, useState, ReactNode } from "react";

interface SearchBarContextType {
    query: string;
    setQuery: (query: string) => void;
    isFocused: boolean;
    setIsFocused: (focused: boolean) => void;
}

const SearchBarContext = createContext<SearchBarContextType | undefined>(undefined);

export const SearchBarProvider = ({ children }: { children: ReactNode }) => {
    const [query, setQuery] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    return (
        <SearchBarContext.Provider value={{ query, setQuery, isFocused, setIsFocused }}>
            {children}
        </SearchBarContext.Provider>
    );
};

export const useSearchBar = () => {
    const context = useContext(SearchBarContext);
    if (!context) {
        throw new Error("useSearchBar must be used within a SearchBarProvider");
    }
    return context;
};
