const Bill = require('../models/Bill');

// Get sales summary and payment breakdown
exports.getSalesSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {
      paymentStatus: 'paid',
    };

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            message: 'Invalid startDate',
          });
        }

        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            message: 'Invalid endDate',
          });
        }

        // Include the entire end date when YYYY-MM-DD is supplied.
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          end.setUTCHours(23, 59, 59, 999);
        }

        filter.createdAt.$lte = end;
      }

      if (
        filter.createdAt.$gte &&
        filter.createdAt.$lte &&
        filter.createdAt.$gte > filter.createdAt.$lte
      ) {
        return res.status(400).json({
          message: 'startDate must be before endDate',
        });
      }
    }

    const summary = await Bill.aggregate([
      { $match: filter },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$totalAmount' },
                totalBills: { $sum: 1 },
              },
            },
          ],
          paymentBreakdown: [
            {
              $group: {
                _id: '$paymentMethod',
                totalAmount: { $sum: '$totalAmount' },
                count: { $sum: 1 },
              },
            },
          ],
          topProducts: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.product',
                productName: { $first: '$items.productName' },
                quantitySold: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.subtotal' },
              },
            },
            { $sort: { quantitySold: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ]);

    const result = summary[0];

    res.status(200).json({
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      totalRevenue: result.totals[0]?.totalRevenue || 0,
      totalBills: result.totals[0]?.totalBills || 0,
      paymentBreakdown: result.paymentBreakdown,
      topProducts: result.topProducts,
    });
  } catch (error) {
    console.error('Sales summary error:', error);

    res.status(500).json({
      message: 'Failed to generate sales summary',
    });
  }
};

// Get daily sales totals
exports.getDailySales = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {
      paymentStatus: 'paid',
    };

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            message: 'Invalid startDate',
          });
        }

        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            message: 'Invalid endDate',
          });
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          end.setUTCHours(23, 59, 59, 999);
        }

        filter.createdAt.$lte = end;
      }
    }

    const dailySales = await Bill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'Asia/Kolkata',
            },
          },
          totalRevenue: { $sum: '$totalAmount' },
          totalBills: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json(dailySales);
  } catch (error) {
    console.error('Daily sales error:', error);

    res.status(500).json({
      message: 'Failed to fetch daily sales',
    });
  }
};