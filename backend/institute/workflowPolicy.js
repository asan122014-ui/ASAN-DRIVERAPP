export function requireIndividualParent(req, res, next) {
  if (req.parent?.accountSource === 'institute') return res.status(403).json({ success: false, message: 'Your Institute manages children, driver assignments and transport booking. Contact your transport coordinator for changes.' });
  next();
}
