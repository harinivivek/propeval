import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  reportCategory: string;
  locality: string | null;
  price: string | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PurchaseDialog({
  reportCategory,
  locality,
  price,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Purchase</DialogTitle>
          <DialogDescription>
            Purchase this {reportCategory.toLowerCase()} report
            {locality ? ` for ${locality}` : ""}?
          </DialogDescription>
        </DialogHeader>
        {price ? (
          <p className="text-lg font-bold">
            Price: <span className="text-emerald-700">₹{price}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Price per your lender pricing agreement.
          </p>
        )}
        <DialogFooter>
          <Button
            onClick={onCancel}
            disabled={loading}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : "Buy Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
