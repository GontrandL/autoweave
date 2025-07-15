/**
 * @name Unsafe eval usage in AutoWeave
 * @description Detects usage of eval() or similar dangerous functions
 * @kind problem
 * @problem.severity error
 * @id autoweave/unsafe-eval
 * @tags security
 *       external/cwe/cwe-094
 */

import javascript

from CallExpr call
where
  (
    call.getCalleeName() = "eval" or
    call.getCalleeName() = "Function" or
    call.getCalleeName() = "execSync" or
    call.getCalleeName() = "exec"
  ) and
  not call.getFile().getRelativePath().matches("%test%") and
  not call.getFile().getRelativePath().matches("%spec%")
select call, "Unsafe " + call.getCalleeName() + "() usage - consider using safer alternatives"