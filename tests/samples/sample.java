package com.enterprise.billing;

import java.util.List;
import java.util.concurrent.CompletableFuture;

public enum InvoiceStatus {
    DRAFT,
    PAID,
    VOID
}

public interface InvoiceService {
    CompletableFuture<String> generateInvoice(String customerId);
}

public class BillingProcessor implements InvoiceService {
    private String gatewayEndpoint;

    public CompletableFuture<String> generateInvoice(String customerId) {
        return CompletableFuture.completedFuture("INV-1001");
    }

    public void refundInvoice(String invoiceId) {
        // TODO: implement refund
        throw new UnsupportedOperationException();
    }
}
