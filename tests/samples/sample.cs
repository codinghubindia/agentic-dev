using System;
using System.Threading.Tasks;

namespace Enterprise.Orders;

public enum OrderState
{
    Pending,
    Processing,
    Completed
}

public interface IOrderService
{
    Task<bool> ProcessOrderAsync(string orderId);
}

public class OrderManager : IOrderService
{
    public string ServiceName { get; set; } = "OrderManager";

    public async Task<bool> ProcessOrderAsync(string orderId)
    {
        return await Task.FromResult(true);
    }

    public void CancelOrder(string orderId)
    {
        // TODO: cancel logic
        throw new NotImplementedException();
    }
}
