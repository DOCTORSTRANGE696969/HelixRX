import re

with open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the dashboard
dashboard_start = content.find('<!-- Bottom: Genomic Intelligence Dashboard -->')
dashboard_end = content.find('<!-- Hidden JSON Panel -->')

if dashboard_start != -1 and dashboard_end != -1:
    # Look backwards from dashboard_end to find the closing tags of the main container.
    # The structure before JSON panel is:
    #         </div>
    #       </div>
    #     </main>
    # We want to replace everything from dashboard_start to just before those closing tags.
    
    # Let's extract the part before the dashboard
    part1 = content[:dashboard_start]
    
    # We need to close the overview section. The flex container `flex flex-col xl:flex-row gap-6 mb-6` needs a closing `</div>`.
    # And then the `app-section` needs a closing `</div>`.
    # Wait, the `part1` ends right after the right panel's closing `</div>`.
    # So the flex row `div` is closed at the end of part1? Let's check `index.html`.
    # Actually, line 280 is the end of `right panel`
    # line 281 is the closing `</div>` of the `flex flex-col xl:flex-row`
    # line 285 is the dashboard start.
    
    # So we can just replace the dashboard with our new sections, and the closing tags will naturally match!
    
    part2_start = content.rfind('</div>', dashboard_start, dashboard_end)
    # Actually, the easiest way is to use regex:
    
    content = re.sub(
        r'<!-- Bottom: Genomic Intelligence Dashboard -->.*?(?=</main>)',
        '''          </div>
        </div>

        <!-- SECTION: Sequences -->
        <div id="section-sequences" class="app-section hidden h-full flex flex-col items-center justify-center min-h-[400px]">
          <i class="fa-solid fa-vial text-4xl text-slate-200 mb-4"></i>
          <h3 class="text-lg font-display font-bold text-slate-800">Sequence Library</h3>
          <p class="text-sm text-slate-500 mt-2">Manage your uploaded genomic sequences here.</p>
        </div>

        <!-- SECTION: Molecular Mapping -->
        <div id="section-molecular-mapping" class="app-section hidden h-full flex flex-col items-center justify-center min-h-[400px]">
          <i class="fa-solid fa-diagram-project text-4xl text-slate-200 mb-4"></i>
          <h3 class="text-lg font-display font-bold text-slate-800">Molecular Mapping</h3>
          <p class="text-sm text-slate-500 mt-2">Advanced molecular pathway visualization coming soon.</p>
        </div>

        <!-- SECTION: History -->
        <div id="section-history" class="app-section hidden h-full flex flex-col items-center justify-center min-h-[400px]">
          <i class="fa-solid fa-clipboard-list text-4xl text-slate-200 mb-4"></i>
          <h3 class="text-lg font-display font-bold text-slate-800">Analysis History</h3>
          <p class="text-sm text-slate-500 mt-2">Past clinical risk analyses and logs.</p>
        </div>

        <!-- SECTION: Settings -->
        <div id="section-settings" class="app-section hidden h-full flex flex-col items-center justify-center min-h-[400px]">
          <i class="fa-solid fa-gear text-4xl text-slate-200 mb-4"></i>
          <h3 class="text-lg font-display font-bold text-slate-800">Settings</h3>
          <p class="text-sm text-slate-500 mt-2">Configure application preferences and integrations.</p>
        </div>
      </div>
    ''',
        content,
        flags=re.DOTALL
    )

    # Wrap the overview section
    content = content.replace('<div class="flex flex-col xl:flex-row gap-6 mb-6">',
'''<!-- SECTION: Overview -->
          <div id="section-overview" class="app-section">
            <div class="flex flex-col xl:flex-row gap-6 mb-6">''')

    # Update JS logic
    js_old = """      // Sidebar logic integration
      const sidebarNavItems = document.querySelectorAll('.nav-item');
      sidebarNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Visual active state swap
          sidebarNavItems.forEach(nav => {
            nav.classList.remove('active', 'bg-white', 'shadow-[0_2px_4px_rgba(0,0,0,0.05)]');
          });
          e.currentTarget.classList.add('active', 'bg-white', 'shadow-[0_2px_4px_rgba(0,0,0,0.05)]');
          
          const sectionName = e.currentTarget.innerText.trim();
          console.log(`[Navigation] User clicked on section: ${sectionName}`);
          
          // In a real app, this would route to different components. 
          // For now, we capture the action and log it.
        });
      });"""
      
    js_new = """      // Sidebar logic integration
      const sidebarNavItems = document.querySelectorAll('.nav-item');
      sidebarNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Visual active state swap
          sidebarNavItems.forEach(nav => {
            nav.classList.remove('active', 'bg-white', 'shadow-[0_2px_4px_rgba(0,0,0,0.05)]');
          });
          e.currentTarget.classList.add('active', 'bg-white', 'shadow-[0_2px_4px_rgba(0,0,0,0.05)]');
          
          const sectionName = e.currentTarget.innerText.trim();
          const targetId = 'section-' + sectionName.toLowerCase().replace(/\\s+/g, '-');
          
          // Hide all sections, show target
          document.querySelectorAll('.app-section').forEach(sec => sec.classList.add('hidden'));
          const targetSection = document.getElementById(targetId);
          if(targetSection) {
            targetSection.classList.remove('hidden');
          }
          console.log(`[Navigation] Switched to section: ${sectionName}`);
        });
      });"""
      
    content = content.replace(js_old, js_new)
    
    with open('templates/index.html', 'w', encoding='utf-8') as out_f:
        out_f.write(content)
