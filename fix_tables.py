import re
import os

def fix_table(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the starting point: <div className="bg-white sticky top-0 z-10">
    # Replace the two separate Tables with a single unified table.

    # 1. Replace the inner Table components with raw tables so they share columns correctly
    # but wait, the easiest way to ensure the columns match perfectly and no independent scrolling occurs
    # is to have them in ONE table.

    # We need to extract the TableHeader content and TableBody content
    
    header_pattern = re.compile(r'<\s*TableHeader\s*>.*?<\s*/\s*TableHeader\s*>', re.DOTALL)
    header_match = header_pattern.search(content)
    if not header_match:
        print(f"Could not find TableHeader in {filepath}")
        return
    
    # Add sticky classes to TableHeader
    header_content = header_match.group(0)
    new_header_content = header_content.replace('<TableHeader>', '<TableHeader className="bg-white sticky top-0 z-20 shadow-sm">')

    # Remove the entire first div containing the header table
    first_div_pattern = re.compile(r'<div className="bg-white sticky top-0 z-10">\s*<Table className="table-fixed w-full">\s*<TableHeader>.*?</TableHeader>\s*</Table>\s*</div>', re.DOTALL)
    
    if first_div_pattern.search(content):
        content = first_div_pattern.sub('', content)
    else:
        print(f"Could not find first div in {filepath}")
    
    # Now find the second table and insert the modified header inside it!
    # The second table starts with <Table className="table-fixed w-full">\s*<TableBody>
    second_table_pattern = re.compile(r'(<Table className="table-fixed w-full">\s*)(<TableBody>)', re.DOTALL)
    
    def replacer(match):
        return f'<table className="w-full text-sm table-fixed border-collapse">\n{new_header_content}\n{match.group(2)}'
        
    if second_table_pattern.search(content):
        content = second_table_pattern.sub(replacer, content)
    else:
        print(f"Could not find second table in {filepath}")

    # Also change the closing </Table> for the second table to </table>
    # We find the very next </Table> after TableBody.
    # Actually, replacing all </Table> that are right after </TableBody> is safer.
    content = re.sub(r'(</TableBody>\s*)</Table>', r'\1</table>', content)
    
    # Fix the wrapper div to be overflow-auto instead of overflow-y-auto so the whole table can scroll horizontally
    content = content.replace('className={`flex-1 min-h-0 overflow-y-auto transition-[max-height] duration-200`}', 'className={`flex-1 min-h-0 overflow-auto transition-[max-height] duration-200`}')

    # Also update the discount column width in the body to match the header (for purchase-items-table)
    if 'purchase-items-table.tsx' in filepath:
        content = content.replace('w-[80px] text-center`} // discount body', 'w-[100px] text-center`} // discount body') # Might not match exactly
        # Let's do a more robust replace for the body discount column
        content = re.sub(r'(hasSplitWarehouse \? \'text-yellow-600 font-medium\' : isSelected \? \'font-medium\' : \'\'} )w-\[80px\]( text-center`}\n\s*onClick={\(e\) => {)', r'\1w-[100px]\2', content)

    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Successfully processed {filepath}")

fix_table('src/renderer/src/components/blocks/common/items-table.tsx')
fix_table('src/renderer/src/components/blocks/purchase/purchase-items-table.tsx')
