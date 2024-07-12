SELECT Node.*,RelNode.id FROM user Node
JOIN user RelNode ON RelNode.id = 'g'
WHERE (Node.tree_left < RelNode.tree_left 
AND Node.tree_right > RelNode.tree_right)
ORDER BY -Node.tree_left 