function calculateSimpleRevenue(purchase, _product) {
    const { discount = 0, sale_price, quantity } = purchase;
    const discountFactor = 1 - (discount / 100);
    return sale_price * quantity * discountFactor;
}

function calculateBonusByProfit(index, total) {
    if (index === 0) return 0.15;           // 1-е место — 15%
    if (index === 1 || index === 2) return 0.10; // 2-е и 3-е места — 10%
    if (index === total - 1) return 0;       // Последнее место — 0%
    return 0.05;                             // Остальные — 5%
}

function analyzeSalesData(data, options) {
    // Валидация входных данных
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)
        || data.purchase_records.length === 0
        || data.sellers.length === 0
        || data.products.length === 0
    ) {
        throw new Error('Некорректные входные данные: проверьте структуру и непустоту массивов sellers, products, purchase_records');
    }

    // Валидация опций
    if (typeof options !== 'object' || options === null) {
        throw new Error('Опции должны быть объектом');
    }

    const { calculateRevenue, calculateBonus } = options;

    if (calculateRevenue === undefined) {
        throw new Error('В опциях отсутствует функция calculateRevenue');
    }
    if (calculateBonus === undefined) {
        throw new Error('В опциях отсутствует функция calculateBonus');
    }

    if (typeof calculateRevenue !== 'function') {
        throw new Error('calculateRevenue должна быть функцией');
    }
    if (typeof calculateBonus !== 'function') {
        throw new Error('calculateBonus должна быть функцией');
    }

    // Инициализация статистики по продавцам
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // Создание индексов для быстрого доступа
    const sellerIndex = Object.fromEntries(sellerStats.map(seller => [seller.id, seller]));
    const productIndex = Object.fromEntries(data.products.map(product => [product.sku, product]));

    // Обработка записей о продажах
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];

        if (!seller) {
            console.warn(`Продавец с ID ${record.seller_id} не найден`);
            return;
        }

        // Обновляем счётчики для чека
        seller.sales_count += 1;
        seller.revenue += record.total_amount || 0;

        // Обработка каждого товара в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];

            if (!product) {
                console.warn(`Товар с артикулом ${item.sku} не найден`);
                return;
            }

            // Рассчитываем себестоимость
            const cost = (product.purchase_price || 0) * item.quantity;

            // Расчёт выручки с использованием переданной функции
            const revenue = calculateRevenue(
                { quantity: item.quantity, discount: item.discount || 0, sale_price: item.sale_price },
                product
            );

            // Прибыль от продажи товара
            const profit = revenue - cost;
            seller.profit += profit;

            // Учёт проданных товаров по артикулам
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Сортируем продавцов по прибыли (по убыванию) для расчёта бонусов
    const sortedSellers = [...sellerStats].sort((a, b) => b.profit - a.profit);

    /**
     * Функция для расчёта коэффициента бонуса на основе позиции в рейтинге
     * @param {number} index - порядковый номер в отсортированном массиве (0 — первое место)
     * @param {number} total - общее число продавцов
     * @returns {number} - коэффициент бонуса (0.15, 0.10, 0.05 или 0)
     */
    function calculateBonusByProfit(index, total) {
        if (index === 0) return 0.15;           // 1-е место — 15%
        if (index === 1 || index === 2) return 0.10; // 2-е и 3-е места — 10%
        if (index === total - 1) return 0;       // Последнее место — 0%
        return 0.05;                             // Остальные — 5%
    }

    // Рассчитываем бонусы и формируем топ-10 товаров для каждого продавца
    sortedSellers.forEach((seller, index) => {
        seller.bonusRate = calculateBonusByProfit(index, sortedSellers.length);
        seller.bonusAmount = seller.profit * seller.bonusRate;

        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // Формируем итоговый отчёт с округлением финансовых показателей
    return sortedSellers.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonusAmount.toFixed(2)
    }));
}
