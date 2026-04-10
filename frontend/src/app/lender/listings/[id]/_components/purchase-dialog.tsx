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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold mb-2">Confirm Purchase</h3>
        <p className="text-sm text-gray-600 mb-4">
          Purchase this {reportCategory.toLowerCase()} report
          {locality ? ` for ${locality}` : ""}?
        </p>
        {price ? (
          <p className="text-lg font-bold mb-4">
            Price: <span className="text-green-700">₹{price}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-4">
            Price per your lender pricing agreement.
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Buy Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
