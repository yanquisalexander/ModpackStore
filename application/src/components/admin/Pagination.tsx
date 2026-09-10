import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LucideChevronLeft, LucideChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    itemLabel?: string;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [];

    if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages - 1, totalPages);
    } else if (currentPage >= totalPages - 2) {
        pages.push(1, 2, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }

    return pages;
}

export const Pagination = ({
    currentPage,
    totalPages,
    total,
    limit,
    onPageChange,
    onLimitChange,
    itemLabel = 'elementos',
}: PaginationProps) => {
    if (totalPages <= 1) return null;

    const start = ((currentPage - 1) * limit) + 1;
    const end = Math.min(currentPage * limit, total);
    const pages = getPageNumbers(currentPage, totalPages);

    return (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                    Mostrando {start}–{end} de {total} {itemLabel}
                </p>
                <Select value={limit.toString()} onValueChange={(v) => onLimitChange(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px] text-xs bg-muted/30 border-border">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="border-border bg-muted/30 hover:bg-muted/30 text-xs h-8 w-8 p-0"
                >
                    <LucideChevronLeft className="h-4 w-4" />
                </Button>

                {pages.map((page, i) =>
                    page === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                            ...
                        </span>
                    ) : (
                        <Button
                            key={page}
                            variant={page === currentPage ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onPageChange(page)}
                            className={`text-xs h-8 w-8 p-0 ${
                                page === currentPage
                                    ? 'bg-primary text-primary-foreground'
                                    : 'border-border bg-muted/30 hover:bg-muted/30'
                            }`}
                        >
                            {page}
                        </Button>
                    )
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="border-border bg-muted/30 hover:bg-muted/30 text-xs h-8 w-8 p-0"
                >
                    <LucideChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};
