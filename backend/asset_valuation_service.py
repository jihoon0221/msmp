from __future__ import annotations

from datetime import date, datetime, timezone
from collections.abc import Iterable

from schemas import (
    AssetAllocationValuation,
    AssetCurrencySummary,
    AssetValuationRequest,
    AssetValuationResponse,
    BondAssetValuation,
    BondAssetValuationInput,
    DepositAssetValuation,
    DepositAssetValuationInput,
    StockAssetValuation,
    StockAssetValuationInput,
)


ALLOCATION_META = {
    "stock-etf": {"label": "주식/ETF", "color": "#2563eb"},
    "deposit-savings": {"label": "예금/적금", "color": "#16a34a"},
    "bond": {"label": "채권", "color": "#f59e0b"},
}


def evaluate_asset_portfolio(request: AssetValuationRequest) -> AssetValuationResponse:
    stock_valuations = [evaluate_stock_asset(asset) for asset in request.stockAssets]
    deposit_valuations = [evaluate_deposit_asset(asset) for asset in request.depositAssets]
    bond_valuations = [evaluate_bond_asset(asset) for asset in request.bondAssets]

    stock_value_krw = sum_value_krw(asset.valueKrw for asset in stock_valuations)
    deposit_value_krw = sum_value_krw(asset.valueKrw for asset in deposit_valuations)
    bond_value_krw = sum(asset.currentValueKrw for asset in bond_valuations)
    total_value_krw = stock_value_krw + deposit_value_krw + bond_value_krw

    return AssetValuationResponse(
        totalValueKrw=round_money(total_value_krw),
        currencySummaries=build_currency_summaries(
            stock_valuations,
            deposit_valuations,
            bond_valuations,
        ),
        allocations=build_allocations(
            {
                "stock-etf": stock_value_krw,
                "deposit-savings": deposit_value_krw,
                "bond": bond_value_krw,
            },
            total_value_krw,
        ),
        stockAssets=stock_valuations,
        depositAssets=deposit_valuations,
        bondAssets=bond_valuations,
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )


def evaluate_stock_asset(asset: StockAssetValuationInput) -> StockAssetValuation:
    purchase_value_native = asset.quantity * asset.averageBuyPrice
    current_value_native = None if asset.latestPrice is None else asset.quantity * asset.latestPrice
    effective_value_native = current_value_native if current_value_native is not None else purchase_value_native
    fx_rate = get_current_fx_rate(asset.stock.currency, asset.latestFxRate)
    purchase_value_krw = purchase_value_native * fx_rate if fx_rate is not None else None
    value_krw = effective_value_native * fx_rate if fx_rate is not None else None
    profit_loss_native = None if current_value_native is None else current_value_native - purchase_value_native

    return StockAssetValuation(
        id=asset.id,
        currency=asset.stock.currency,
        purchaseValueNative=round_money(purchase_value_native),
        currentValueNative=round_optional_money(current_value_native),
        effectiveValueNative=round_money(effective_value_native),
        purchaseValueKrw=round_optional_money(purchase_value_krw),
        valueKrw=round_optional_money(value_krw),
        profitLossNative=round_optional_money(profit_loss_native),
        returnPercent=calculate_return_percent(profit_loss_native, purchase_value_native),
        fxRate=fx_rate,
    )


def evaluate_deposit_asset(asset: DepositAssetValuationInput) -> DepositAssetValuation:
    fx_rate = get_current_fx_rate(asset.currency, None)
    value_krw = asset.currentAmount * fx_rate if fx_rate is not None else None

    return DepositAssetValuation(
        id=asset.id,
        currency=asset.currency,
        valueNative=round_money(asset.currentAmount),
        valueKrw=round_optional_money(value_krw),
        fxRate=fx_rate,
    )


def evaluate_bond_asset(asset: BondAssetValuationInput) -> BondAssetValuation:
    purchase_fx_rate = get_purchase_fx_rate(asset)
    current_fx_rate = get_bond_current_fx_rate(asset)
    accrued_value_native = get_bond_accrued_value(asset)
    principal_value_krw = asset.principalAmount * purchase_fx_rate
    current_value_krw = accrued_value_native * current_fx_rate
    profit_loss_krw = current_value_krw - principal_value_krw

    return BondAssetValuation(
        id=asset.id,
        currency=asset.currency,
        principalValueKrw=round_money(principal_value_krw),
        currentValueKrw=round_money(current_value_krw),
        profitLossKrw=round_money(profit_loss_krw),
        returnPercent=calculate_return_percent(profit_loss_krw, principal_value_krw) or 0,
        purchaseFxRate=purchase_fx_rate,
        currentFxRate=current_fx_rate,
        accruedValueNative=round_money(accrued_value_native),
    )


def build_currency_summaries(
    stock_valuations: list[StockAssetValuation],
    deposit_valuations: list[DepositAssetValuation],
    bond_valuations: list[BondAssetValuation],
) -> list[AssetCurrencySummary]:
    totals: dict[str, float] = {}

    for valuation in stock_valuations:
        add_total(totals, valuation.currency, valuation.effectiveValueNative)

    for valuation in deposit_valuations:
        add_total(totals, valuation.currency, valuation.valueNative)

    for valuation in bond_valuations:
        add_total(totals, "KRW", valuation.currentValueKrw)

    return [
        AssetCurrencySummary(currency=currency, totalValue=round_money(total))
        for currency, total in sorted(totals.items())
    ]


def build_allocations(values_by_key: dict[str, float], total_value_krw: float) -> list[AssetAllocationValuation]:
    allocations: list[AssetAllocationValuation] = []

    for key, meta in ALLOCATION_META.items():
        value = values_by_key.get(key, 0)
        weight = round((value / total_value_krw) * 100) if total_value_krw > 0 else 0
        allocations.append(
            AssetAllocationValuation(
                key=key,
                label=meta["label"],
                color=meta["color"],
                weight=weight,
                valueKrw=round_money(value),
            )
        )

    return allocations


def get_current_fx_rate(currency: str, latest_fx_rate: float | None) -> float | None:
    if currency == "KRW":
        return 1
    if currency == "USD":
        return latest_fx_rate
    return None


def get_purchase_fx_rate(asset: BondAssetValuationInput) -> float:
    if asset.currency == "KRW":
        return 1
    return asset.purchaseFxRate or asset.latestFxRate or 1


def get_bond_current_fx_rate(asset: BondAssetValuationInput) -> float:
    if asset.currency == "KRW":
        return 1
    return asset.latestFxRate or asset.purchaseFxRate or 1


def get_bond_accrued_value(asset: BondAssetValuationInput) -> float:
    coupon_rate = asset.couponRate or 0
    elapsed_days = get_elapsed_days(asset.purchaseDate)
    return asset.principalAmount * (1 + (coupon_rate / 100) * (elapsed_days / 365))


def get_elapsed_days(value: str | None) -> int:
    if not value:
        return 0

    try:
        purchased_at = date.fromisoformat(value)
    except ValueError:
        return 0

    return max(0, (date.today() - purchased_at).days)


def add_total(totals: dict[str, float], currency: str, value: float) -> None:
    if value <= 0:
        return
    totals[currency] = totals.get(currency, 0) + value


def sum_value_krw(values: Iterable[float | None]) -> float:
    return sum(value for value in values if value is not None)


def calculate_return_percent(profit_loss: float | None, base_value: float) -> float | None:
    if profit_loss is None:
        return None
    if base_value <= 0:
        return 0
    return round((profit_loss / base_value) * 100, 4)


def round_money(value: float) -> float:
    return round(value, 2)


def round_optional_money(value: float | None) -> float | None:
    if value is None:
        return None
    return round_money(value)
