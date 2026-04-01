const express = require("express");
const router = express.Router();
const Lead = require("../models/lead");
const Bot = require("../models/bot");
const User = require("../models/users");
const { body, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const botOwner = require("../middleware/botOwner");

// Middleware to check if user has access to lead
async function leadAccess(req, res, next) {
  try {
    const leadId = req.params.id || req.body.leadId;

    if (!leadId) {
      return res.status(400).json({
        error: "Lead ID required",
        message: "Lead ID is missing from request"
      });
    }

    const lead = await Lead.findOne({ _id: leadId, isDeleted: false });

    if (!lead) {
      return res.status(404).json({
        error: "Lead not found",
        message: "The requested lead does not exist or has been deleted"
      });
    }

    // Check if user has access to this lead's bot
    const bot = await Bot.findOne({ botId: lead.botId, userId: req.user.id });

    if (!bot) {
      return res.status(403).json({
        error: "Access denied",
        message: "You don't have permission to access this lead"
      });
    }

    req.lead = lead;
    req.bot = bot;
    next();
  } catch (err) {
    console.error("Lead access error:", err);
    return res.status(500).json({
      error: "Authentication error",
      message: "An error occurred while verifying lead access"
    });
  }
}

// GET /api/leads - List leads with filters
router.get("/", auth, async (req, res) => {
  try {
    const {
      botId,
      status,
      assignedTo,
      tags,
      search,
      minScore,
      maxScore,
      dateFrom,
      dateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    const query = { isDeleted: false };

    // Get user's bots to filter leads
    const userBots = await Bot.find({ userId: req.user.id }).select("botId");
    const botIds = userBots.map(b => b.botId);

    if (botIds.length === 0) {
      return res.json({ leads: [], total: 0, page: 1, pages: 0 });
    }

    query.botId = { $in: botIds };

    if (botId) query.botId = botId;
    if (status) query.leadStatus = status;
    if (assignedTo) query.assignedTo = assignedTo === "unassigned" ? null : assignedTo;
    if (tags && Array.isArray(tags)) query.tags = { $in: tags };
    if (minScore !== undefined) query.leadScore = { ...query.leadScore, $gte: parseInt(minScore) };
    if (maxScore !== undefined) query.leadScore = { ...query.leadScore, $lte: parseInt(maxScore) };
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate("assignedTo", "name email")
        .populate("botId", "name category")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Lead.countDocuments(query)
    ]);

    // Get bot names for reference
    const botMap = {};
    userBots.forEach(bot => {
      botMap[bot.botId] = bot.name;
    });

    // Enhance leads with bot name
    const enrichedLeads = leads.map(lead => ({
      ...lead,
      botName: botMap[lead.botId] || "Unknown Bot"
    }));

    res.json({
      leads: enrichedLeads,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });

  } catch (err) {
    console.error("Get leads error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch leads"
    });
  }
});

// GET /api/leads/stats - Get lead statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const { botId, dateFrom, dateTo } = req.query;

    // Get user's bots
    const userBots = await Bot.find({ userId: req.user.id }).select("botId name");
    const botIds = userBots.map(b => b.botId);

    if (botIds.length === 0) {
      return res.json({
        total: 0,
        byStatus: {},
        byInterest: {},
        avgScore: 0,
        hotLeads: 0,
        converted: 0
      });
    }

    // Build date filter
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
    }

    const query = { botId: { $in: botIds }, isDeleted: false, ...dateFilter };
    if (botId) query.botId = botId;

    const [leads, statusStats, interestStats] = await Promise.all([
      Lead.find(query),
      Lead.aggregate([
        { $match: query },
        { $group: { _id: "$leadStatus", count: { $sum: 1 } } }
      ]),
      Lead.aggregate([
        { $match: query },
        { $group: { _id: "$interestLevel", count: { $sum: 1 } } }
      ])
    ]);

    const total = leads.length;
    const avgScore = leads.length > 0
      ? Math.round(leads.reduce((sum, l) => sum + (l.leadScore || 0), 0) / total)
      : 0;

    const hotLeads = leads.filter(l => l.leadScore >= 70).length;
    const converted = leads.filter(l => l.leadStatus === 'converted').length;

    // Format stats
    const byStatus = {};
    statusStats.forEach(s => { byStatus[s._id] = s.count; });

    const byInterest = {};
    interestStats.forEach(i => { byInterest[i._id] = i.count; });

    // Get top sources
    const sourceStats = await Lead.aggregate([
      { $match: query },
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get conversion rate by bot
    const botConversion = await Promise.all(
      userBots.map(async (bot) => {
        const botLeads = await Lead.find({
          botId: bot.botId,
          isDeleted: false,
          ...dateFilter
        });
        const totalBot = botLeads.length;
        const convertedBot = botLeads.filter(l => l.leadStatus === 'converted').length;
        return {
          botId: bot.botId,
          botName: bot.name,
          total: totalBot,
          converted: convertedBot,
          conversionRate: totalBot > 0 ? (convertedBot / totalBot * 100).toFixed(1) + '%' : '0%'
        };
      })
    );

    res.json({
      total,
      avgScore,
      hotLeads,
      converted,
      conversionRate: total > 0 ? (converted / total * 100).toFixed(1) + '%' : '0%',
      byStatus,
      byInterest,
      topSources: sourceStats,
      byBot: botConversion,
      updatedAt: new Date()
    });

  } catch (err) {
    console.error("Get lead stats error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch lead statistics"
    });
  }
});

// GET /api/leads/:id - Get single lead with full details
router.get("/:id", auth, leadAccess, async (req, res) => {
  try {
    const lead = req.lead;

    // Populate references
    await lead.populate("assignedTo", "name email");
    await lead.populate("botId", "name category");

    res.json({
      success: true,
      lead
    });

  } catch (err) {
    console.error("Get lead error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch lead details"
    });
  }
});

// POST /api/leads - Create lead manually
router.post("/", auth, [
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional(),
  body('name').optional().trim(),
  body('leadStatus').optional().isIn(['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted', 'lost', 'cold']),
  body('tags').optional().isArray(),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      botId,
      email,
      phone,
      name,
      company,
      message,
      leadStatus,
      tags,
      notes,
      potentialValue,
      source
    } = req.body;

    // Verify bot belongs to user
    const bot = await Bot.findOne({ botId, userId: req.user.id });
    if (!bot) {
      return res.status(403).json({
        success: false,
        message: "Invalid bot ID or access denied"
      });
    }

    // Check for duplicate email/phone
    if (email) {
      const existing = await Lead.findOne({ email, isDeleted: false });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "A lead with this email already exists"
        });
      }
    }

    const leadData = {
      botId,
      email,
      phone,
      name: name || "Unknown",
      company,
      message,
      leadStatus: leadStatus || 'new',
      leadScore: 0,
      interestLevel: 'low',
      tags: tags || [],
      potentialValue: potentialValue || 0,
      source: source || 'manual'
    };

    const lead = new Lead(leadData);
    await lead.save();

    // Add note if provided
    if (notes) {
      lead.notes.push({
        content: notes,
        addedBy: req.user.id,
        isPrivate: false
      });
      await lead.save();
    }

    res.status(201).json({
      success: true,
      lead,
      message: "Lead created successfully"
    });

  } catch (err) {
    console.error("Create lead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create lead"
    });
  }
});

// PUT /api/leads/:id - Update lead
router.put("/:id", auth, leadAccess, [
  body('leadStatus').optional().isIn(['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted', 'lost', 'cold']),
  body('interestLevel').optional().isIn(['high', 'medium', 'low', 'none']),
  body('tags').optional().isArray(),
  body('customFields').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const lead = req.lead;
    const {
      leadStatus,
      interestLevel,
      tags,
      customFields,
      assignedTo,
      nextFollowUpAt,
      followUpReminder,
      potentialValue,
      notes,
      callNotes
    } = req.body;

    // Update fields
    if (leadStatus !== undefined) lead.leadStatus = leadStatus;
    if (interestLevel !== undefined) lead.interestLevel = interestLevel;
    if (tags !== undefined) lead.tags = tags;
    if (customFields !== undefined) lead.customFields = { ...lead.customFields, ...customFields };
    if (assignedTo !== undefined) lead.assignedTo = assignedTo || null;
    if (nextFollowUpAt !== undefined) lead.nextFollowUpAt = nextFollowUpAt;
    if (followUpReminder !== undefined) lead.followUpReminder = followUpReminder;
    if (potentialValue !== undefined) lead.potentialValue = potentialValue;

    // Handle conversion tracking
    if (leadStatus === 'converted' && lead.leadStatus !== 'converted') {
      lead.convertedAt = new Date();
      lead.convertedBy = req.user.id;
      lead.conversionValue = potentialValue || lead.potentialValue;
    }

    // Add note if provided
    if (notes) {
      lead.notes.push({
        content: notes,
        addedBy: req.user.id,
        isPrivate: false
      });
    }

    // Add call note if provided
    if (callNotes && Array.isArray(callNotes)) {
      lead.callNotes.push(...callNotes.map(note => ({
        ...note,
        date: new Date()
      })));
    }

    await lead.save();

    res.json({
      success: true,
      lead,
      message: "Lead updated successfully"
    });

  } catch (err) {
    console.error("Update lead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update lead"
    });
  }
});

// POST /api/leads/:id/status - Quick status update
router.post("/:id/status", auth, leadAccess, async (req, res) => {
  try {
    const { leadStatus } = req.body;

    if (!leadStatus || !['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted', 'lost', 'cold'].includes(leadStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const lead = req.lead;
    const oldStatus = lead.leadStatus;
    lead.leadStatus = leadStatus;

    // Track conversion
    if (leadStatus === 'converted' && oldStatus !== 'converted') {
      lead.convertedAt = new Date();
      lead.convertedBy = req.user.id;
    }

    await lead.save();

    // Add status change to notes
    lead.notes.push({
      content: `Status changed from "${oldStatus}" to "${leadStatus}"`,
      addedBy: req.user.id,
      isPrivate: false
    });
    await lead.save();

    res.json({
      success: true,
      lead,
      message: "Status updated"
    });

  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update status"
    });
  }
});

// POST /api/leads/:id/assign - Assign lead to user
router.post("/:id/assign", auth, leadAccess, async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId === undefined) {
      return res.json({ success: true, lead: req.lead }); // Unassign
    }

    // Verify user exists
    const assignee = await User.findById(userId);
    if (!assignee) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    req.lead.assignedTo = userId;
    req.lead.assignedBy = req.user.id;
    await req.lead.save();

    // Add note
    req.lead.notes.push({
      content: `Assigned to ${assignee.name}`,
      addedBy: req.user.id,
      isPrivate: false
    });
    await req.lead.save();

    res.json({
      success: true,
      lead: req.lead,
      message: "Lead assigned successfully"
    });

  } catch (err) {
    console.error("Assign lead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to assign lead"
    });
  }
});

// DELETE /api/leads/:id - Soft delete lead
router.delete("/:id", auth, leadAccess, async (req, res) => {
  try {
    const lead = req.lead;
    lead.isDeleted = true;
    lead.deletedAt = new Date();
    await lead.save();

    res.json({
      success: true,
      message: "Lead deleted (soft delete)"
    });

  } catch (err) {
    console.error("Delete lead error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete lead"
    });
  }
});

// POST /api/leads/:id/notes - Add note to lead
router.post("/:id/notes", auth, leadAccess, async (req, res) => {
  try {
    const { content, isPrivate } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Note content is required"
      });
    }

    req.lead.notes.push({
      content: content.trim(),
      addedBy: req.user.id,
      isPrivate: isPrivate || false,
      createdAt: new Date()
    });

    await req.lead.save();

    res.json({
      success: true,
      lead: req.lead,
      message: "Note added"
    });

  } catch (err) {
    console.error("Add note error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add note"
    });
  }
});

// GET /api/leads/:id/activities - Get lead activity timeline
router.get("/:id/activities", auth, leadAccess, async (req, res) => {
  try {
    const lead = req.lead;

    // Build activity timeline
    const activities = [];

    // Notes
    lead.notes.forEach(note => {
      activities.push({
        type: 'note',
        date: note.createdAt,
        content: note.content.substring(0, 200),
        private: note.isPrivate
      });
    });

    // Call logs
    lead.callNotes.forEach(call => {
      activities.push({
        type: 'call',
        date: call.date,
        content: `Call: ${call.outcome} (${call.duration}s) - ${call.notes.substring(0, 100)}`
      });
    });

    // Status changes (we could store these separately, but for now infer from notes)
    // In production, create a separate LeadActivity model

    // Sort by date desc
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      activities: activities.slice(0, 50) // Limit to 50 most recent
    });

  } catch (err) {
    console.error("Get activities error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activities"
    });
  }
});

// POST /api/leads/import - Import leads from CSV
router.post("/import", auth, async (req, res) => {
  try {
    const { botId, leads: leadData, createDuplicates } = req.body;

    if (!botId || !Array.isArray(leadData) || leadData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "botId and leads array are required"
      });
    }

    // Verify bot belongs to user
    const bot = await Bot.findOne({ botId, userId: req.user.id });
    if (!bot) {
      return res.status(403).json({
        success: false,
        message: "Invalid bot ID or access denied"
      });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const [index, lead] of leadData.entries()) {
      try {
        // Check for duplicates
        if (!createDuplicates) {
          if (lead.email) {
            const existing = await Lead.findOne({
              email: lead.email,
              botId,
              isDeleted: false
            });
            if (existing) {
              skipped++;
              errors.push(`Row ${index + 1}: Email ${lead.email} already exists`);
              continue;
            }
          }
        }

        const newLead = new Lead({
          botId,
          name: lead.name || "Unknown",
          email: lead.email || "",
          phone: lead.phone || "",
          company: lead.company || "",
          message: lead.message || "",
          leadStatus: lead.leadStatus || 'new',
          leadScore: lead.leadScore || 0,
          interestLevel: lead.interestLevel || 'low',
          tags: lead.tags || [],
          source: lead.source || 'imported',
          customFields: lead.customFields || {}
        });

        await newLead.save();
        imported++;

      } catch (err) {
        skipped++;
        errors.push(`Row ${index + 1}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      imported,
      skipped,
      errors,
      message: `Imported ${imported} leads, skipped ${skipped}`
    });

  } catch (err) {
    console.error("Import leads error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to import leads"
    });
  }
});

// GET /api/leads/export - Export leads as CSV
router.get("/export", auth, async (req, res) => {
  try {
    const { botId, status, format = 'csv' } = req.query;

    // Get user's bots
    const userBots = await Bot.find({ userId: req.user.id }).select("botId name");
    const botIds = userBots.map(b => b.botId);

    const query = { botId: { $in: botIds }, isDeleted: false };
    if (botId) query.botId = botId;
    if (status) query.leadStatus = status;

    const leads = await Lead.find(query)
      .populate("assignedTo", "name email")
      .populate("botId", "name")
      .lean();

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        "ID", "Name", "Email", "Phone", "Company", "Bot", "Status",
        "Score", "Interest", "Tags", "Assigned To", "Created At"
      ];

      const csvRows = [];
      csvRows.push(headers.join(","));

      leads.forEach(lead => {
        const row = [
          lead._id,
          `"${lead.name.replace(/"/g, '""')}"`,
          lead.email || "",
          lead.phone || "",
          `"${(lead.company || '').replace(/"/g, '""')}"`,
          lead.botId?.name || "Unknown",
          lead.leadStatus,
          lead.leadScore,
          lead.interestLevel,
          `"${(lead.tags || []).join(';').replace(/"/g, '""')}"`,
          lead.assignedTo?.name || "Unassigned",
          lead.createdAt
        ].map(field => `"${field}"`).join(",");
        csvRows.push(row);
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="leads-export-${Date.now()}.csv"`);
      res.send(csvRows.join("\n"));

    } else {
      // JSON format
      res.json({
        success: true,
        leads,
        count: leads.length
      });
    }

  } catch (err) {
    console.error("Export leads error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to export leads"
    });
  }
});

// GET /api/leads/tags - Get all unique tags
router.get("/tags/all", auth, async (req, res) => {
  try {
    const userBots = await Bot.find({ userId: req.user.id }).select("botId");
    const botIds = userBots.map(b => b.botId);

    const tags = await Lead.distinct("tags", {
      botId: { $in: botIds },
      isDeleted: false
    }).filter(tag => tag); // Remove empty/null

    res.json({ tags });

  } catch (err) {
    console.error("Get tags error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch tags"
    });
  }
});

// GET /api/users - Get list of users (for lead assignment)
router.get("/users", auth, async (req, res) => {
  try {
    const users = await User.find({}, "name email")
      .sort({ name: 1 })
      .lean();

    res.json({ users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch users"
    });
  }
});

module.exports = router;
